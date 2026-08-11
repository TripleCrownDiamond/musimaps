-- ============================================================
-- 00031 — Cover, sync du profil revendiqué, édition par l'artiste
-- - map_artists.cover : image de couverture (bannière).
-- - get_claimed_profile : le profil de la carte revendiqué par
--   l'utilisateur connecté.
-- - update_claimed_profile : l'artiste propriétaire édite photo,
--   cover, bio et liens de SON profil (vérifie claimed_by).
-- ============================================================

ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS cover text;

-- RPC : profil de la carte revendiqué par l'utilisateur connecté.
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
  SELECT id, name, genre, city, country, flag, lat, lng, bio,
         image, cover, source, platforms, socials, verified, claimed_by
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
    'verified', v_row.verified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_claimed_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_claimed_profile() TO authenticated;

-- RPC : l'artiste met à jour SON profil revendiqué (photo, cover, bio, liens).
-- L'admin reste le seul à pouvoir toucher verified / claimed_by / ville.
CREATE OR REPLACE FUNCTION public.update_claimed_profile(
  p_image text DEFAULT NULL,
  p_cover text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_platforms jsonb DEFAULT NULL,
  p_socials jsonb DEFAULT NULL,
  p_genre text DEFAULT NULL
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
        socials = coalesce(p_socials, socials)
    WHERE id = v_artist_id;

  RETURN jsonb_build_object('ok', true, 'id', v_artist_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_claimed_profile(text, text, text, jsonb, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_claimed_profile(text, text, text, jsonb, jsonb, text) TO authenticated;

-- Sync à la revendication : le nom d'affichage du compte devient le nom
-- du profil revendiqué (le compte artiste reflète la carte).
CREATE OR REPLACE FUNCTION public.sync_claimed_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.claimed_by IS NOT NULL AND (OLD.claimed_by IS NULL OR OLD.claimed_by IS DISTINCT FROM NEW.claimed_by) THEN
    UPDATE public.profiles
      SET display_name = coalesce(NULLIF(display_name, ''), NEW.name),
          city = coalesce(NULLIF(city, ''), NEW.city)
      WHERE id = NEW.claimed_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_map_artists_sync_claimed ON public.map_artists;
CREATE TRIGGER trg_map_artists_sync_claimed
  AFTER UPDATE OF claimed_by ON public.map_artists
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_claimed_profile();
