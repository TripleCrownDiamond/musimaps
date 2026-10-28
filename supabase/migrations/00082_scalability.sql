-- ============================================================
-- 00082 — Tenir la charge sur le plan gratuit de Supabase.
--
-- 1. VERSION DE LA CARTE. Chaque ouverture de l'app téléchargeait toute la
--    table map_artists (≈ 200 Ko, 53 Ko compressés pour 296 artistes),
--    plusieurs fois par session. L'app garde désormais la liste en cache et
--    ne demande que ce numéro de version (quelques octets) : la liste n'est
--    retéléchargée que si un artiste a été ajouté, modifié ou supprimé.
--    Trigger PAR INSTRUCTION : un import de 300 lignes = +1, pas +300.
--
-- 2. VUES GROUPÉES. record_artist_view faisait une écriture par profil ou
--    pin consulté. record_artist_views reçoit un lot (envoyé toutes les
--    ~30 s par l'app) : un seul aller-retour, un INSERT et un UPSERT.
--    Même journal artist_views (une ligne par vue, les stats uniques ne
--    changent pas), mêmes compteurs artist_stats. L'ancien RPC reste en
--    place pour les versions de l'app déjà installées.
--
-- 3. QUOTA IA. Les edge functions ai_verify / ai_artist_agent appellent
--    Mistral sans limite. consume_ai_quota compte les appels par jour :
--    par compte (connecté), par adresse IP (anonyme), et au total. Appelé
--    uniquement par les edge functions avec la clé service_role.
--
-- Idempotente : rejouable sans effet de bord.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Version de la carte
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.map_artists_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  version    bigint NOT NULL DEFAULT 1,
  changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.map_artists_meta (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.map_artists_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "map_artists_meta_no_direct" ON public.map_artists_meta;
CREATE POLICY "map_artists_meta_no_direct" ON public.map_artists_meta FOR SELECT USING (false);

CREATE OR REPLACE FUNCTION public.bump_map_artists_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.map_artists_meta
     SET version = version + 1, changed_at = now()
   WHERE id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_map_artists_version() FROM public;

DROP TRIGGER IF EXISTS trg_map_artists_version ON public.map_artists;
CREATE TRIGGER trg_map_artists_version
  AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.map_artists
  FOR EACH STATEMENT EXECUTE FUNCTION public.bump_map_artists_version();

CREATE OR REPLACE FUNCTION public.map_artists_version()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT version FROM public.map_artists_meta WHERE id
$$;
REVOKE ALL ON FUNCTION public.map_artists_version() FROM public;
GRANT EXECUTE ON FUNCTION public.map_artists_version() TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. Vues groupées
-- ------------------------------------------------------------
-- p_events : [{"artist_id": "...", "kind": "profile"|"pin", "count": 3}, …]
-- Plafonds : 100 entrées par lot, 20 vues par entrée (un client normal
-- n'en approche pas ; au-delà, le surplus est ignoré).
-- Une seule instruction (CTE) : ni table temporaire ni boucle, même sous
-- forte charge.
CREATE OR REPLACE FUNCTION public.record_artist_views(
  p_events     jsonb,
  p_viewer_key text DEFAULT NULL,
  p_country    text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text;
  v_total   integer;
BEGIN
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RETURN 0;
  END IF;

  -- Pays : même règle que record_artist_view.
  v_country := NULLIF(btrim(coalesce(p_country, '')), '');
  IF v_country IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT NULLIF(btrim(split_part(coalesce(city, ''), ',', -1)), '')
      INTO v_country
      FROM public.profiles
     WHERE id = auth.uid();
  END IF;

  WITH raw AS (
    SELECT btrim(item ->> 'artist_id') AS artist_id,
           item ->> 'kind' AS kind,
           CASE WHEN item ->> 'count' ~ '^[0-9]{1,6}$'
                THEN LEAST(GREATEST((item ->> 'count')::integer, 1), 20)
                ELSE 1 END AS n
      FROM jsonb_array_elements(p_events) WITH ORDINALITY AS t(item, ord)
     WHERE t.ord <= 100
       AND jsonb_typeof(item) = 'object'
  ),
  -- Entrées valides seulement : type connu, artiste existant (un artiste
  -- supprimé entre la vue et l'envoi ne fait pas échouer tout le lot).
  batch AS (
    SELECT r.artist_id, r.kind, LEAST(sum(r.n), 20)::integer AS n
      FROM raw r
      JOIN public.map_artists a ON a.id = r.artist_id
     WHERE r.kind IN ('profile', 'pin')
     GROUP BY r.artist_id, r.kind
  ),
  -- Journal : une ligne par vue, comme record_artist_view.
  logged AS (
    INSERT INTO public.artist_views (artist_id, user_id, viewer_key, kind, country)
    SELECT b.artist_id, auth.uid(), NULLIF(p_viewer_key, ''), b.kind, v_country
      FROM batch b, generate_series(1, b.n)
    RETURNING 1
  ),
  -- Compteurs agrégés : un UPSERT par artiste.
  counted AS (
    INSERT INTO public.artist_stats (artist_id, profile_views, pin_views, updated_at)
    SELECT artist_id,
           coalesce(sum(n) FILTER (WHERE kind = 'profile'), 0),
           coalesce(sum(n) FILTER (WHERE kind = 'pin'), 0),
           now()
      FROM batch
     GROUP BY artist_id
    ON CONFLICT (artist_id) DO UPDATE
      SET profile_views = public.artist_stats.profile_views + EXCLUDED.profile_views,
          pin_views     = public.artist_stats.pin_views + EXCLUDED.pin_views,
          updated_at    = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_total FROM logged;

  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.record_artist_views(jsonb, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_artist_views(jsonb, text, text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. Quota IA
-- ------------------------------------------------------------
-- subject : 'user:<uuid>', 'ip:<adresse>' ou 'global'. Une ligne par jour
-- (UTC). Les lignes de plus de 30 jours sont purgées au fil de l'eau.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  subject text NOT NULL,
  day     date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  calls   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, day)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_no_direct" ON public.ai_usage;
CREATE POLICY "ai_usage_no_direct" ON public.ai_usage FOR SELECT USING (false);

-- Consomme un appel si les trois plafonds le permettent. Atomique : deux
-- requêtes simultanées ne peuvent pas dépasser le plafond ensemble.
-- p_subject_limit <= 0 : pas de plafond individuel (administrateurs).
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_subject       text,
  p_subject_limit integer,
  p_global_limit  integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day   date := (now() AT TIME ZONE 'utc')::date;
  v_calls integer;
BEGIN
  IF coalesce(btrim(p_subject), '') = '' THEN
    RETURN false;
  END IF;

  -- Plafond global d'abord : il protège le budget quoi qu'il arrive.
  INSERT INTO public.ai_usage (subject, day, calls) VALUES ('global', v_day, 1)
  ON CONFLICT (subject, day) DO UPDATE SET calls = public.ai_usage.calls + 1
  RETURNING calls INTO v_calls;
  IF p_global_limit > 0 AND v_calls > p_global_limit THEN
    UPDATE public.ai_usage SET calls = calls - 1 WHERE subject = 'global' AND day = v_day;
    RETURN false;
  END IF;

  IF p_subject_limit > 0 THEN
    INSERT INTO public.ai_usage (subject, day, calls) VALUES (p_subject, v_day, 1)
    ON CONFLICT (subject, day) DO UPDATE SET calls = public.ai_usage.calls + 1
    RETURNING calls INTO v_calls;
    IF v_calls > p_subject_limit THEN
      UPDATE public.ai_usage SET calls = calls - 1 WHERE subject = p_subject AND day = v_day;
      UPDATE public.ai_usage SET calls = calls - 1 WHERE subject = 'global' AND day = v_day;
      RETURN false;
    END IF;
  END IF;

  -- Ménage : 1 fois sur 100 environ, pour ne pas payer un DELETE par appel.
  IF random() < 0.01 THEN
    DELETE FROM public.ai_usage WHERE day < v_day - 30;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer) TO service_role;
