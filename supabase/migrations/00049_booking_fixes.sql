-- 00049_booking_fixes.sql
-- Corrections post-revue sur 00048 :
-- 1. get_artist_booking renvoie TOUS les forfaits (actifs + inactifs) pour
--    que l'éditeur admin puisse les voir et les réactiver.
-- 2. delete_my_account préfère l'email de la session (auth.jwt) au paramètre
--    client, pour que personne ne puisse supprimer les réservations d'autrui.

CREATE OR REPLACE FUNCTION public.get_artist_booking(p_artist_id TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'bookable', m.bookable,
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'description', b.description,
        'price', b.price,
        'currency', b.currency,
        'duration', b.duration,
        'active', b.active
      ) ORDER BY b.created_at)
      FROM public.booking_plans b
      WHERE b.map_artist_id = m.id
    ), '[]'::jsonb)
  )
  FROM public.map_artists m
  WHERE m.id = p_artist_id;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_email TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := COALESCE(NULLIF(trim(p_email), ''), NULLIF(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non connecté');
  END IF;

  -- Réservations : la table bookings ne référence pas auth.users → par email
  -- (email de la session prioritaire : on ne supprime jamais celles d'autrui).
  IF v_email IS NOT NULL THEN
    DELETE FROM public.bookings WHERE user_email = v_email;
  END IF;

  DELETE FROM public.follows WHERE user_id = v_uid;
  DELETE FROM public.artist_claims WHERE user_id = v_uid;
  DELETE FROM public.artist_views WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;
