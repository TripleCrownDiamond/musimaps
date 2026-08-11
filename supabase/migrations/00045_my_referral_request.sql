-- ============================================================
-- 00045 — Ma demande de référencement (artiste connecté)
-- La table waitlist est en lecture admin-only (RLS). Un artiste
-- connecté qui a soumis sa demande via le formulaire /artistes
-- (avec user_id, migration 00044) doit pouvoir retrouver sa
-- demande dans son dashboard : statut, ville, genre, bio, photo,
-- liens. Ce RPC (SECURITY DEFINER) ne renvoie que SA ligne.
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_referral_request()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- La demande la plus récente de l'utilisateur connecté.
  SELECT id, email, profile, artist_name, city, genre, link, bio, photo,
         spotify, youtube, instagram, user_id, converted_at, map_artist_id,
         created_at
    INTO v_row
    FROM public.waitlist
   WHERE user_id = auth.uid()
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'profile', v_row.profile,
    'artistName', v_row.artist_name,
    'city', v_row.city,
    'genre', v_row.genre,
    'link', v_row.link,
    'bio', v_row.bio,
    'photo', v_row.photo,
    'spotify', v_row.spotify,
    'youtube', v_row.youtube,
    'instagram', v_row.instagram,
    'userId', v_row.user_id,
    'convertedAt', v_row.converted_at,
    'mapArtistId', v_row.map_artist_id,
    'createdAt', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_referral_request() FROM public;
GRANT EXECUTE ON FUNCTION public.my_referral_request() TO authenticated;
