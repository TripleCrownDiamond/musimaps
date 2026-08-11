-- ============================================================
-- 00021 — Waitlist enrichie + photos artistes
-- Le formulaire artiste collecte désormais bio, photo et liens
-- (Spotify / YouTube / Instagram) en plus des champs actuels.
-- Les photos sont uploadées dans un bucket public `artist-images`
-- (écriture ouverte à tous comme la table waitlist, lecture publique).
-- ============================================================

-- 1. Colonnes supplémentaires de la waitlist
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS bio      TEXT,
  ADD COLUMN IF NOT EXISTS photo    TEXT,
  ADD COLUMN IF NOT EXISTS spotify  TEXT,
  ADD COLUMN IF NOT EXISTS youtube  TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT;

-- 2. Bucket public pour les photos de profil artiste
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artist-images',
  'artist-images',
  true,
  5242880,  -- 5 Mo par photo
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture publique (le site affiche les photos).
DROP POLICY IF EXISTS "artist_images_select_public" ON storage.objects;
CREATE POLICY "artist_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'artist-images');

-- Écriture ouverte : le formulaire artiste (web + mobile) upload en anon,
-- comme l'insertion dans waitlist. On limite aux types image via le bucket.
DROP POLICY IF EXISTS "artist_images_insert_public" ON storage.objects;
CREATE POLICY "artist_images_insert_public"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artist-images');

-- Suppression : seuls les admins nettoient.
DROP POLICY IF EXISTS "artist_images_delete_admin" ON storage.objects;
CREATE POLICY "artist_images_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'artist-images' AND public.is_admin());
