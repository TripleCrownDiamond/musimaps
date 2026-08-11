-- ============================================================
-- 00042 — Sanitisation des localisations des artistes
--
-- Audité par reverse-géocodage Mapbox de chaque pin (67 artistes,
-- 22 anomalies). Corrections :
--   1. Pins impossibles / mal placés (ex. Zeynab de Cotonou placée
--      en Biélorussie, Papa Wemba à Abidjan, « Guinée » géocodée en
--      Guinée équatoriale, centroïdes de pays pour les villes vides).
--   2. Champ country normalisé en code ISO (Bénin→BJ, Guinée→GN,
--      RDC→CD, France→FR, Canada→CA, Togo→TG, Nigeria→NG…) + flag.
--   3. Country = nationalité aligné sur le pays du pin (cohérence
--      carte : « London, US » devient « London, GB », etc.).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Pins impossibles → coordonnées réelles de la ville déclarée
-- ------------------------------------------------------------
-- Cotonou, Bénin (2.4401, 6.3734)
UPDATE public.map_artists
   SET lat = 6.373391, lng = 2.4401, country = 'BJ', flag = '🇧🇯'
 WHERE id = 'mb-a4f07ac8-8e9f-44d7-a2bb-cbb77a2f5694'; -- Zeynab (était en Biélorussie)

UPDATE public.map_artists
   SET lat = 6.373391, lng = 2.4401, country = 'BJ', flag = '🇧🇯'
 WHERE id = 'wiki-Q231276'; -- Angélique Kidjo (était dans le nord du Bénin)

UPDATE public.map_artists
   SET lat = 6.373391, lng = 2.4401, country = 'BJ', flag = '🇧🇯'
 WHERE id = 'wiki-Q2028674'; -- Orchestre Poly-Rythmo de Cotonou

UPDATE public.map_artists
   SET lat = 6.373391, lng = 2.4401, country = 'BJ', flag = '🇧🇯'
 WHERE id = 'wiki-Q59209882'; -- Sessimè

-- Kinshasa, RD Congo (15.3129, -4.3252)
UPDATE public.map_artists
   SET lat = -4.325152, lng = 15.312853, country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-07f9fb91-1147-4532-a522-ac36dacd1c72'; -- Papa Wemba (était à Abidjan)

UPDATE public.map_artists
   SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'wiki-Q65962115'; -- Gaz Mawete (pays en toutes lettres)

-- Conakry, Guinée (-13.6998, 9.5171)
UPDATE public.map_artists
   SET lat = 9.51706, lng = -13.699843, city = 'Conakry', country = 'GN', flag = '🇬🇳'
 WHERE id = 'wiki-Q131700049'; -- THIIRD (était en Guinée équatoriale)

UPDATE public.map_artists
   SET lat = 9.51706, lng = -13.699843, city = 'Conakry', country = 'GN', flag = '🇬🇳'
 WHERE id = 'wiki-Q93341103'; -- Jupiter Davibe (était en Guinée équatoriale)

-- Trappes / Paris, France
UPDATE public.map_artists
   SET lat = 48.7761, lng = 2.001495, country = 'FR', flag = '🇫🇷'
 WHERE id = 'wiki-Q284995'; -- La Fouine (centroïde France)

UPDATE public.map_artists
   SET lat = 48.8566, lng = 2.3522, city = 'Paris', country = 'FR', flag = '🇫🇷'
 WHERE id = 'wiki-Q65147968'; -- Alpha Wann (centroïde France)

UPDATE public.map_artists
   SET lat = 48.8566, lng = 2.3522, city = 'Paris', country = 'FR', flag = '🇫🇷'
 WHERE id = 'wiki-Q144166'; -- Zaho (centroïde Canada — basée en France)

-- Nairobi, Kenya
UPDATE public.map_artists
   SET lat = -1.2833, lng = 36.8167, city = 'Nairobi', country = 'KE', flag = '🇰🇪'
 WHERE id = 'mb-14a78189-c93d-44e1-b014-2c46912c9c33'; -- Kamore (pays absent, pin déjà Nairobi)

-- Porto Alegre, Brésil (pays était « Porto Alegre »)
UPDATE public.map_artists
   SET lat = -30.0331, lng = -51.23, country = 'BR', flag = '🇧🇷'
 WHERE id = 'mb-80c6367c-ce65-45d3-a8a2-37f6406fb1a4'; -- Sexteto Blazz

-- Togo (pays en toutes lettres, pin déjà au Togo)
UPDATE public.map_artists
   SET country = 'TG', flag = '🇹🇬'
 WHERE id = 'wiki-Q117472515'; -- Aamron

-- ------------------------------------------------------------
-- 2. Country = nationalité → pays du pin (cohérence carte)
-- ------------------------------------------------------------
-- London (pin UK)
UPDATE public.map_artists SET country = 'GB', flag = '🇬🇧' WHERE id = 'mb-37b2cb82-ef79-4d46-a184-a549450aa231'; -- 21 Savage

-- Lagos (pin Nigeria)
UPDATE public.map_artists SET country = 'NG', flag = '🇳🇬' WHERE id = 'mb-43c577a8-fc4a-42b4-8160-3f8f7af41c70'; -- Ambrose Campbell
UPDATE public.map_artists SET country = 'NG', flag = '🇳🇬' WHERE id = 'omah-lay'; -- Omah Lay (pays en toutes lettres)

-- Nairobi (pin Kenya)
UPDATE public.map_artists SET country = 'KE', flag = '🇰🇪' WHERE id = 'mb-c39b100f-0e43-4e39-b244-a33d6dcb09a0'; -- Extra Golden

-- Dakar (pin Sénégal)
UPDATE public.map_artists SET country = 'SN', flag = '🇸🇳'
 WHERE id IN (
   'mb-697eaf40-f43b-4c19-9269-4bf52536f1a3', -- Carole Fredericks
   'mb-a6584364-8f75-4361-b399-2e3f9d2cd149', -- Karin Mensah
   'mb-c66e4504-414e-4ab0-940b-88a471c90ce5', -- Souleymane Diamanka
   'mb-fdb39e70-1365-42fb-b878-dd661e8406bc', -- Fatima Al Qadiri
   'mb-25b0d755-16e6-4ff8-ab4f-7226279019c2'  -- Élage Diouf
 );

-- Abidjan (pin Côte d'Ivoire)
UPDATE public.map_artists SET country = 'CI', flag = '🇨🇮'
 WHERE id IN (
   'mb-0fce100c-e908-4967-885a-01505e72e265', -- Clovis Nicolas
   'mb-19dc0692-d61b-4039-8e63-195e60834689', -- Cécile Verny
   'mb-5852dd45-e65d-47ad-b0e8-8c2f70432bf0', -- Floby
   'mb-bc05a883-fb01-4564-9df4-7c421a1f0797', -- Malik Mezzadri
   'mb-047c604f-66c7-4ef0-abc0-2fd342a46cbb'  -- Magic Malik
 );
