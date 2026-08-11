-- ============================================================
-- 00043 — Stats des likes sur les profils artistes
-- ------------------------------------------------------------
-- - count_artist_likes : compteur public des likes (favoris)
--   d'un artiste — même principe que count_artist_followers
--   (la table favorites est protégée par RLS, on expose un
--   comptage via une fonction SECURITY DEFINER).
-- - artist_stats_detail étendu : ajoute `likes` (total favoris)
--   et `likes_by_day` (série 14 jours) pour le dashboard artiste.
-- ============================================================

-- 0. Garantie de colonne created_at sur favorites (pour la série 14 jours)
ALTER TABLE public.favorites
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 1. Compteur public des likes
CREATE OR REPLACE FUNCTION public.count_artist_likes(p_artist_id text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.favorites
  WHERE artist_id = p_artist_id;
$$;

REVOKE ALL ON FUNCTION public.count_artist_likes(text) FROM public;
GRANT EXECUTE ON FUNCTION public.count_artist_likes(text) TO anon, authenticated;

-- 2. Analytics artiste étendues avec les likes (favoris) et leur série.
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
    'likes', (SELECT count(*)::bigint FROM public.favorites WHERE artist_id = p_artist_id),
    'likes_by_day', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'likes', coalesce(v.cnt, 0)
      ) ORDER BY d.day)
      FROM generate_series(now() - interval '13 days', now(), interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', created_at) AS day, count(*) AS cnt
        FROM public.favorites
        WHERE artist_id = p_artist_id AND created_at >= now() - interval '14 days'
        GROUP BY 1
      ) v ON v.day = d.day
    ), '[]'::jsonb),
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
