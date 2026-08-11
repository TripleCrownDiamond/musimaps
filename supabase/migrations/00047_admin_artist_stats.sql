-- ============================================================
-- 00047 — Stats par artiste pour l'admin
-- L'admin doit pouvoir voir les performances de chaque artiste
-- de la carte : vues profil / pin, visiteurs uniques, likes,
-- abonnés et réservations — et savoir s'il a un compte
-- (claimed) ou s'il est seulement sur la carte.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_artist_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT jsonb_build_object(
    'artists', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'city', a.city,
        'country', a.country,
        'flag', a.flag,
        'image', a.image,
        'genre', a.genre,
        'verified', a.verified,
        'claimed', a.claimed_by IS NOT NULL,
        'created_at', a.created_at,
        'views_profile', (
          SELECT count(*) FROM public.artist_views v
          WHERE v.artist_id = a.id AND v.kind = 'profile'
        ),
        'views_pin', (
          SELECT count(*) FROM public.artist_views v
          WHERE v.artist_id = a.id AND v.kind = 'pin'
        ),
        'unique_viewers', (
          SELECT count(DISTINCT coalesce(v.user_id::text, 'dev:' || v.viewer_key))
          FROM public.artist_views v
          WHERE v.artist_id = a.id
        ),
        'likes', (
          SELECT count(*) FROM public.favorites f
          WHERE f.artist_id = a.id
        ),
        'followers', (
          SELECT count(DISTINCT f.user_id) FROM public.favorites f
          WHERE f.artist_id = a.id
        ),
        'bookings', (
          SELECT count(*) FROM public.bookings b
          WHERE b.artist_id = a.id
        )
      ) ORDER BY a.name)
      FROM public.map_artists a
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_artist_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_artist_stats() TO authenticated;
