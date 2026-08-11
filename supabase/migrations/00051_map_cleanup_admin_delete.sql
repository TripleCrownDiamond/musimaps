-- ============================================================
-- 00051 — map_artists : DELETE admin + nettoyage des données
--
-- 1. L'admin ne pouvait pas SUPPRIMER un artiste de la carte (aucune
--    politique DELETE → bouton « Supprimer » de l'admin muet). On ajoute
--    une politique DELETE réservée à l'admin.
-- 2. Nettoyage des anomalies repérées par l'audit :
--    - doublon Angélique Kidjo (mb- + wiki-) → on garde le plus riche ;
--    - Ossaiofficial (artiste de test, city = « Nigeria » = pays comme
--      ville) → suppression ;
--    - Aamron (city vide, pin sans libellé) → suppression : sans ville
--      précise il repassera par le référencement.
-- ============================================================

-- 1) L'admin peut supprimer un artiste découvert.
DROP POLICY IF EXISTS "map_artists_delete_admin" ON public.map_artists;
CREATE POLICY "map_artists_delete_admin"
  ON public.map_artists FOR DELETE
  USING (public.is_admin());

-- 2) Nettoyage des données (par id : jamais par nom, pour éviter de
--    toucher un homonyme légitime).
DELETE FROM public.map_artists
WHERE id = 'wiki-Q231276'
  AND name ILIKE '%kidjo%';

DELETE FROM public.map_artists
WHERE id = 'mb-beff0f92-2b0a-4f33-93b3-cbeeb2c6931e'
  AND name ILIKE '%ossai%';

DELETE FROM public.map_artists
WHERE id = 'wiki-Q117472515'
  AND name ILIKE '%aamron%';
