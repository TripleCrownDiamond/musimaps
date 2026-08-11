-- ============================================================
-- 00033 — Orthographe : « Musimaps » → « MusiMaps »
-- Corrige les contenus stockés (site_content : FR + EN, publié +
-- brouillons) pour uniformiser la marque partout.
-- ============================================================

-- content / content_en / draft / draft_en sont des colonnes jsonb.
-- On remplace les occurrences dans la représentation texte puis on
-- recaste en jsonb ; les contenus valides restent valides.
UPDATE public.site_content
SET content = replace(content::text, 'Musimaps', 'MusiMaps')::jsonb
WHERE content::text LIKE '%Musimaps%';

UPDATE public.site_content
SET content_en = replace(content_en::text, 'Musimaps', 'MusiMaps')::jsonb
WHERE content_en::text LIKE '%Musimaps%';

UPDATE public.site_content
SET draft = replace(draft::text, 'Musimaps', 'MusiMaps')::jsonb
WHERE draft::text LIKE '%Musimaps%';

UPDATE public.site_content
SET draft_en = replace(draft_en::text, 'Musimaps', 'MusiMaps')::jsonb
WHERE draft_en::text LIKE '%Musimaps%';
