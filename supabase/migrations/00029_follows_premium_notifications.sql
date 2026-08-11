-- ============================================================
-- 00029 — Follows, Premium et Notifications de découverte
-- - follows : « Suivre » un artiste (distinct du like/favori).
-- - profiles.account_type : + 'premium' (liens illimités, notifs…).
-- - notifications : alertes de découverte (nouvel artiste près de
--   chez soi, selon ses préférences ou les artistes qu'il suit).
-- ============================================================

-- ------------------------------------------------------------
-- 1. follows — abonnements aux artistes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id  TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Chacun lit et gère SES abonnements.
DROP POLICY IF EXISTS "follows_select_own" ON public.follows;
CREATE POLICY "follows_select_own"
  ON public.follows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE
  USING (auth.uid() = user_id);

-- Migration des favoris existants vers les abonnements : les « abonnés »
-- comptaient auparavant les favoris ; on les conserve comme follows pour ne
-- pas faire chuter les compteurs à zéro au lancement.
INSERT INTO public.follows (user_id, artist_id)
SELECT DISTINCT user_id, artist_id FROM public.favorites
ON CONFLICT DO NOTHING;

-- Le compteur « abonnés » d'un artiste = nombre d'utilisateurs qui le
-- suivent (lecture publique, sans exposer la table).
DROP FUNCTION IF EXISTS public.count_artist_followers(text);
CREATE OR REPLACE FUNCTION public.count_artist_followers(p_artist_id text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.follows
  WHERE artist_id = p_artist_id;
$$;

REVOKE ALL ON FUNCTION public.count_artist_followers(text) FROM public;
GRANT EXECUTE ON FUNCTION public.count_artist_followers(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. profiles.account_type — + 'premium' (+ colonnes notifs)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_genres jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS city text;

DO $$
BEGIN
  ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_account_type_check;
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_type_check
    CHECK (account_type IN ('personal', 'business', 'premium'));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Bascule personal <-> business <-> premium sur son propre compte.
CREATE OR REPLACE FUNCTION public.set_account_type(p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_type NOT IN ('personal', 'business', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_type');
  END IF;
  UPDATE public.profiles SET account_type = p_type WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_account_type(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_account_type(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_premium()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND account_type = 'premium'
  );
$$;

REVOKE ALL ON FUNCTION public.is_premium() FROM public;
GRANT EXECUTE ON FUNCTION public.is_premium() TO authenticated;

-- ------------------------------------------------------------
-- 3. notifications — alertes de découverte d'artistes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'discovery'
              CHECK (type IN ('discovery', 'followed_artist', 'preference', 'nearby')),
  artist_id   TEXT,
  artist_name TEXT,
  city        TEXT,
  country     TEXT,
  message     TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx
  ON public.notifications (user_id, read DESC, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
CREATE POLICY "notifications_insert_admin"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. RPC notify_discovery — signale un nouvel artiste ajouté à la
-- carte aux utilisateurs concernés : ceux de la même ville/pays,
-- ceux dont les genres préférés correspondent, et ceux qui suivent
-- un artiste de la même zone. Insertion SECURITY DEFINER car la
-- politique d'insertion est réservée à l'admin.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_discovery(
  p_artist_id text,
  p_artist_name text,
  p_genre text,
  p_city text,
  p_country text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Même ville (préférence de localisation déclarée dans le profil).
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT p.id, 'nearby', p_artist_id, p_artist_name, p_city, p_country,
         p_artist_name || ' est maintenant sur la carte — près de chez toi !'
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND NULLIF(p.city, '') IS NOT NULL
    AND NULLIF(p_city, '') IS NOT NULL
    AND lower(p.city) LIKE '%' || lower(p_city) || '%'
  ON CONFLICT DO NOTHING;

  -- 2) Genres préférés de l'utilisateur qui correspondent au genre.
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT p.id, 'preference', p_artist_id, p_artist_name, p_city, p_country,
         'Nouvel artiste ' || coalesce(p_genre, '') || ' à découvrir : ' || p_artist_name
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND NULLIF(p_genre, '') IS NOT NULL
    AND p.favorite_genres IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p.favorite_genres) g
      WHERE NULLIF(g, '') IS NOT NULL
        AND lower(g) LIKE '%' || lower(p_genre) || '%'
    )
  ON CONFLICT DO NOTHING;

  -- 3) Les abonnés des artistes de la même ville.
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT DISTINCT f.user_id, 'followed_artist', p_artist_id, p_artist_name, p_city, p_country,
         'Un artiste de ' || coalesce(p_city, 'la région') || ' vient d' || '''arriver : ' || p_artist_name
  FROM public.follows f
  JOIN public.map_artists ma ON ma.id = f.artist_id
  WHERE NULLIF(p_city, '') IS NOT NULL
    AND lower(coalesce(ma.city, '')) = lower(p_city)
    AND f.user_id <> auth.uid()
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_discovery(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_discovery(text, text, text, text, text) TO authenticated;
