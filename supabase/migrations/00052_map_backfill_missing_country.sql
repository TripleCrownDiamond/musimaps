-- ============================================================
-- 00052 — Backfill pays manquants (country = NULL)
--
-- L'audit a trouvé 5 artistes avec country NULL alors que leurs
-- coordonnées sont sans ambiguïté : Lagos (NG) ×3 et Accra (GH) ×2.
-- On remplit country (code ISO) + flag (emoji) pour une carte
-- cohérente (stats par pays, filtres, drapeaux des pins).
-- ============================================================

-- Lagos, Nigéria (6.453928, 3.38975)
UPDATE public.map_artists
   SET country = 'NG', flag = '🇳🇬'
 WHERE id IN (
   'mb-dc33cead-2a2a-4b4c-a52a-bd7632fab072', -- Five O' Clock
   'mb-c6d44bb3-73d3-4d84-8eea-4a4ff91e0bd1', -- Bisk
   'mb-15248659-b60e-4572-9071-8094078b4265'  -- Boy rajo
 );

-- Accra, Ghana (5.58505, -0.210768)
UPDATE public.map_artists
   SET country = 'GH', flag = '🇬🇭'
 WHERE id IN (
   'mb-3f2dbf9f-7ac2-4b0a-9696-bb5d9de7a419', -- 2Ministers
   'mb-c081e2f2-2f0e-4d57-9dcf-6dba5255b184'  -- 93 Ish
 );
