-- ============================================================
-- 00036 — Vue d'ensemble admin : statistiques globales
-- RPC admin_stats : tous les compteurs en une requête, réservé
-- aux administrateurs (SECURITY DEFINER + vérification is_admin).
-- Tolérant aux tables absentes (to_regclass) : les migrations
-- peuvent être appliquées en retard, le dashboard ne casse pas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_stats()
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
    -- Artistes sur la carte
    'artists',
    CASE WHEN to_regclass('public.map_artists') IS NOT NULL
         THEN (SELECT count(*) FROM public.map_artists) ELSE 0 END,
    'artists_verified',
    CASE WHEN to_regclass('public.map_artists') IS NOT NULL
         THEN (SELECT count(*) FROM public.map_artists WHERE verified) ELSE 0 END,
    'artists_claimed',
    CASE WHEN to_regclass('public.map_artists') IS NOT NULL
         THEN (SELECT count(*) FROM public.map_artists WHERE claimed_by IS NOT NULL) ELSE 0 END,

    -- Revendications
    'claims_pending',
    CASE WHEN to_regclass('public.artist_claims') IS NOT NULL
         THEN (SELECT count(*) FROM public.artist_claims WHERE status = 'pending') ELSE 0 END,
    'claims_total',
    CASE WHEN to_regclass('public.artist_claims') IS NOT NULL
         THEN (SELECT count(*) FROM public.artist_claims) ELSE 0 END,

    -- Réservations (bookings)
    'bookings_total',
    CASE WHEN to_regclass('public.bookings') IS NOT NULL
         THEN (SELECT count(*) FROM public.bookings) ELSE 0 END,
    'bookings_pending',
    CASE WHEN to_regclass('public.bookings') IS NOT NULL
         THEN (SELECT count(*) FROM public.bookings WHERE status = 'pending') ELSE 0 END,

    -- Liste d'attente
    'waitlist_total',
    CASE WHEN to_regclass('public.waitlist') IS NOT NULL
         THEN (SELECT count(*) FROM public.waitlist) ELSE 0 END,

    -- Comptes utilisateurs
    'users_total',
    CASE WHEN to_regclass('public.profiles') IS NOT NULL
         THEN (SELECT count(*) FROM public.profiles) ELSE 0 END,
    'users_business',
    CASE WHEN to_regclass('public.profiles') IS NOT NULL
         THEN (SELECT count(*) FROM public.profiles WHERE account_type = 'business') ELSE 0 END,
    'users_premium',
    CASE WHEN to_regclass('public.profiles') IS NOT NULL
         THEN (SELECT count(*) FROM public.profiles WHERE account_type = 'premium') ELSE 0 END,
    'users_artists',
    CASE WHEN to_regclass('public.profiles') IS NOT NULL
         THEN (SELECT count(*) FROM public.profiles WHERE role = 'artist') ELSE 0 END,

    -- Abonnements (follows)
    'follows_total',
    CASE WHEN to_regclass('public.follows') IS NOT NULL
         THEN (SELECT count(*) FROM public.follows) ELSE 0 END,

    -- Notifications envoyées
    'notifications_total',
    CASE WHEN to_regclass('public.notifications') IS NOT NULL
         THEN (SELECT count(*) FROM public.notifications) ELSE 0 END,

    -- Vues artistes (stats)
    'views_profile',
    CASE WHEN to_regclass('public.artist_stats') IS NOT NULL
         THEN (SELECT COALESCE(sum(profile_views), 0) FROM public.artist_stats) ELSE 0 END,
    'views_pin',
    CASE WHEN to_regclass('public.artist_stats') IS NOT NULL
         THEN (SELECT COALESCE(sum(pin_views), 0) FROM public.artist_stats) ELSE 0 END,

    -- Favoris
    'favorites_total',
    CASE WHEN to_regclass('public.favorites') IS NOT NULL
         THEN (SELECT count(*) FROM public.favorites) ELSE 0 END
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
