-- ============================================================
-- 00032 — Correctifs 00031 (review)
-- - update_claimed_profile : « '' » permet de VIDER image/cover/bio
--   (coalesce ne le permettait pas).
-- - sync_claimed_profile : copie aussi la ville du profil revendiqué
--   dans le compte quand elle est vide (identité unifiée).
-- ============================================================

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
