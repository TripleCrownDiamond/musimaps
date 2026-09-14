-- ============================================================
-- 00065 — Zeynab ramenée à Cotonou, Bénin
-- ------------------------------------------------------------
-- Pays déclaré Bénin (BJ, 🇧🇯), mais ville « Abidjan » et pin posé à
-- Abidjan, Côte d'Ivoire (5.320357, -4.016107). Ville et coordonnées sont
-- alignées sur Cotonou, au même point que les autres artistes de la ville :
-- le dés-empilement de la carte les écarte à l'affichage.
-- ============================================================

UPDATE public.map_artists
SET city    = 'Cotonou',
    country = 'BJ',
    flag    = '🇧🇯',
    lat     = 6.373391,
    lng     = 2.4401
WHERE id = 'mb-a4f07ac8-8e9f-44d7-a2bb-cbb77a2f5694';
