-- 00057: Ajoute un slug personnalisé aux profils artistes.
-- Le slug permet un lien de profil lisible : /artist/mon-nom-de-scene
-- Nullable : les artistes sans slug continuent d'utiliser leur UUID.

ALTER TABLE map_artists
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Index pour la résolution rapide par slug.
CREATE UNIQUE INDEX IF NOT EXISTS idx_map_artists_slug
  ON map_artists (slug)
  WHERE slug IS NOT NULL;

-- RPC pour vérifier l'unicité du slug (appelé avant sauvegarde).
CREATE OR REPLACE FUNCTION public.check_slug_unique(p_slug TEXT, p_exclude_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM map_artists
    WHERE slug = p_slug
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
$$;

-- RPC pour résoudre un slug en artist ID (appelé par le frontend).
CREATE OR REPLACE FUNCTION public.resolve_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id::uuid FROM map_artists WHERE slug = p_slug LIMIT 1;
$$;
