-- 00060_update_claimed_profile_city_district.sql
-- Étend update_claimed_profile pour permettre à l'artiste de modifier
-- sa ville et son quartier depuis le ClaimedProfileScreen (web + mobile).

CREATE OR REPLACE FUNCTION public.update_claimed_profile(
  p_image text DEFAULT NULL,
  p_cover text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_platforms jsonb DEFAULT NULL,
  p_socials jsonb DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_artist_id
    FROM public.map_artists
    WHERE claimed_by = auth.uid()
    ORDER BY claimed_at DESC
    LIMIT 1;
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_claimed_profile');
  END IF;

  UPDATE public.map_artists
    SET image = CASE WHEN p_image = '' THEN NULL ELSE coalesce(p_image, image) END,
        cover = CASE WHEN p_cover = '' THEN NULL ELSE coalesce(p_cover, cover) END,
        bio = CASE WHEN p_bio = '' THEN NULL ELSE coalesce(p_bio, bio) END,
        genre = coalesce(p_genre, genre),
        platforms = coalesce(p_platforms, platforms),
        socials = coalesce(p_socials, socials),
        city = CASE WHEN p_city IS NOT NULL AND p_city != '' THEN p_city ELSE city END,
        district = CASE WHEN p_district IS NOT NULL THEN NULLIF(p_district, '') ELSE district END,
        slug = CASE WHEN p_slug IS NOT NULL THEN NULLIF(regexp_replace(p_slug, '[^a-zA-Z0-9_-]', '', 'g'), '') ELSE slug END
    WHERE id = v_artist_id;

  -- Sync city to profiles table if provided
  IF p_city IS NOT NULL AND p_city != '' THEN
    UPDATE public.profiles SET city = p_city WHERE id = auth.uid();
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_artist_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_claimed_profile(text, text, text, jsonb, jsonb, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_claimed_profile(text, text, text, jsonb, jsonb, text, text, text, text) TO authenticated;

-- ── get_claimed_profile : retourne aussi district ─────────────────
CREATE OR REPLACE FUNCTION public.get_claimed_profile()
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
  SELECT id, name, genre, city, district, country, flag, lat, lng, bio,
         image, cover, source, platforms, socials, verified, slug, claimed_by
    INTO v_row
    FROM public.map_artists
    WHERE claimed_by = auth.uid()
    ORDER BY claimed_at DESC
    LIMIT 1;
  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'genre', v_row.genre,
    'city', v_row.city,
    'district', v_row.district,
    'country', v_row.country,
    'flag', v_row.flag,
    'lat', v_row.lat,
    'lng', v_row.lng,
    'bio', v_row.bio,
    'image', v_row.image,
    'cover', v_row.cover,
    'source', v_row.source,
    'platforms', coalesce(v_row.platforms, '{}'::jsonb),
    'socials', coalesce(v_row.socials, '{}'::jsonb),
    'verified', v_row.verified,
    'slug', v_row.slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_claimed_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_claimed_profile() TO authenticated;
