-- ============================================================
-- 00040 — Analytics de vues : unique par utilisateur, pays,
--         fréquence, reset + colonne profiles.country
-- ------------------------------------------------------------
-- - artist_views : journal d'événements (une ligne par vue) avec
--   identité utilisateur (auth.uid()) OU clé d'appareil anonyme
--   (viewer_key), type (profil/pin), pays du visiteur.
-- - record_artist_view étendu : garde le compteur artist_stats ET
--   journalise dans artist_views (params optionnels, compat).
-- - artist_stats_detail : vues uniques, top pays, série 14 jours,
--   viewers récurrents (top fréquence) — réservé artiste/admin.
-- - reset_artist_stats : remet les compteurs à zéro (admin).
-- - profiles.country : dérivé de la ville à l'inscription.
-- - RESET immédiat : les compteurs actuels sont remis à zéro
--   (demande explicite — les anciennes vues aggrégées disparaissent,
--   le journal artist_views repart d'une base saine).
-- ============================================================

-- 1. Colonne country sur profiles (dérivée de la ville)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;

-- 2. Journal d'événements de vues
CREATE TABLE IF NOT EXISTS public.artist_views (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id  TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_key TEXT,
  kind       TEXT NOT NULL CHECK (kind IN ('profile', 'pin')),
  country    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artist_views_artist_created_idx
  ON public.artist_views (artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS artist_views_artist_kind_idx
  ON public.artist_views (artist_id, kind);

-- RLS : les lignes sont insérées uniquement via le RPC SECURITY
-- DEFINER record_artist_view ; la lecture brute reste interdite
-- (les agrégats passent par artist_stats_detail).
ALTER TABLE public.artist_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "artist_views_no_public" ON public.artist_views;
CREATE POLICY "artist_views_no_public"
  ON public.artist_views FOR SELECT USING (false);

-- 3. record_artist_view étendu : compteur + journal (params optionnels)
CREATE OR REPLACE FUNCTION public.record_artist_view(
  p_artist_id   text,
  p_kind        text,
  p_viewer_key  text DEFAULT NULL,
  p_country     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
BEGIN
  IF p_kind NOT IN ('profile', 'pin') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  -- Pays du visiteur : priorité au paramètre client, sinon profil,
  -- sinon dernière partie de la ville (« Cotonou, Benin » → « Benin »).
  v_country := NULLIF(btrim(coalesce(p_country, '')), '');
  IF v_country IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT NULLIF(btrim(split_part(coalesce(city, ''), ',', -1)), '')
      INTO v_country
      FROM public.profiles
      WHERE id = auth.uid();
  END IF;

  -- Journal d'événement (source de vérité pour les vues uniques).
  INSERT INTO public.artist_views (artist_id, user_id, viewer_key, kind, country)
  VALUES (p_artist_id, auth.uid(), NULLIF(p_viewer_key, ''), p_kind, v_country);

  -- Compteur aggrégé (lecture rapide, rétro-compatible).
  INSERT INTO public.artist_stats (artist_id, profile_views, pin_views, updated_at)
  VALUES (
    p_artist_id,
    CASE WHEN p_kind = 'profile' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'pin' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (artist_id) DO UPDATE
    SET profile_views = public.artist_stats.profile_views + CASE WHEN p_kind = 'profile' THEN 1 ELSE 0 END,
        pin_views     = public.artist_stats.pin_views + CASE WHEN p_kind = 'pin' THEN 1 ELSE 0 END,
        updated_at    = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_artist_view(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_artist_view(text, text, text, text) TO anon, authenticated;

-- 4. Stats détaillées : vues uniques, pays, 14 jours, viewers récurrents.
-- Réservé à l'artiste propriétaire du profil revendiqué ou à un admin.
CREATE OR REPLACE FUNCTION public.artist_stats_detail(p_artist_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed_by uuid;
  result jsonb;
BEGIN
  -- Gate : propriétaire (claimed_by) ou admin.
  SELECT claimed_by INTO v_claimed_by
    FROM public.map_artists
    WHERE id = p_artist_id;
  IF auth.uid() IS NULL
     OR (v_claimed_by IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'artist_id', p_artist_id,
    'total', (SELECT count(*) FROM public.artist_views WHERE artist_id = p_artist_id),
    'profile_views', (SELECT count(*) FROM public.artist_views WHERE artist_id = p_artist_id AND kind = 'profile'),
    'pin_views', (SELECT count(*) FROM public.artist_views WHERE artist_id = p_artist_id AND kind = 'pin'),
    -- Identité = user_id quand connecté, sinon viewer_key (appareil anonyme).
    'unique_viewers', (
      SELECT count(DISTINCT coalesce(user_id::text, 'dev:' || viewer_key))
      FROM public.artist_views
      WHERE artist_id = p_artist_id
    ),
    'viewers_connected', (
      SELECT count(DISTINCT user_id)
      FROM public.artist_views
      WHERE artist_id = p_artist_id AND user_id IS NOT NULL
    ),
    'top_countries', coalesce((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.views DESC)
      FROM (
        SELECT
          coalesce(NULLIF(country, ''), 'Inconnu') AS country,
          count(*) AS views,
          count(DISTINCT coalesce(user_id::text, 'dev:' || viewer_key)) AS unique_viewers
        FROM public.artist_views
        WHERE artist_id = p_artist_id
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 12
      ) t
    ), '[]'::jsonb),
    'by_day', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'views', coalesce(v.cnt, 0)
      ) ORDER BY d.day)
      FROM generate_series(now() - interval '13 days', now(), interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, count(*) AS cnt
        FROM public.artist_views
        WHERE artist_id = p_artist_id AND created_at >= now() - interval '14 days'
        GROUP BY 1
      ) v ON v.day = d.day
    ), '[]'::jsonb),
    -- Fréquence : combien de fois chaque viewer est revenu (top 8).
    'top_viewers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'label',
          CASE WHEN user_id IS NOT NULL
               THEN coalesce(
                 (SELECT display_name FROM public.profiles WHERE id = v.user_id),
                 left(v.user_id::text, 8)
               )
               ELSE 'Invité · ' || left(v.viewer_key, 8)
          END,
        'views', v.cnt,
        'kind', v.kind
      ) ORDER BY v.cnt DESC)
      FROM (
        SELECT
          user_id,
          viewer_key,
          count(*) AS cnt,
          array_agg(DISTINCT kind ORDER BY kind) AS kind
        FROM public.artist_views
        WHERE artist_id = p_artist_id
        GROUP BY user_id, viewer_key
        ORDER BY cnt DESC
        LIMIT 8
      ) v
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.artist_stats_detail(text) FROM public;
GRANT EXECUTE ON FUNCTION public.artist_stats_detail(text) TO authenticated;

-- 5. Reset des compteurs (admin) : remet artist_stats à zéro et
-- vide le journal artist_views. Appelé depuis l'admin.
CREATE OR REPLACE FUNCTION public.reset_artist_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  TRUNCATE TABLE public.artist_views;
  UPDATE public.artist_stats SET profile_views = 0, pin_views = 0, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_artist_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.reset_artist_stats() TO authenticated;

-- 6. RESET IMMÉDIAT demandé : les compteurs actuels repartent à zéro
-- (le journal artist_views est neuf, il est déjà vide).
UPDATE public.artist_stats SET profile_views = 0, pin_views = 0, updated_at = now();
