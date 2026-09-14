-- ============================================================
-- 00067 — Pays des artistes alignés sur le pays de leur pin
--
-- Règle posée en 00042 : sur la carte, `country` est le pays où se trouve
-- le pin (« London, US » devient « London, GB »). 42 artistes portaient
-- encore leur nationalité, ou aucun pays, au-dessus de leur ville.
--
-- Conséquence visible : le globe regroupe par pays. Le groupe « GB »
-- rassemblait 21 Savage (Londres) avec des artistes posés à Ibadan, Nairobi
-- et Durban ; son point d'ancrage, calculé au milieu, tombait en Afrique et
-- 21 Savage apparaissait « au Nigeria ». Idem pour FR, BE, US, CA, AU, DE.
--
-- Pays du pin obtenu par géocodage inverse Mapbox (niveau pays) de chaque
-- coordonnée le 2026-09-13. Mise à jour par id (jamais par nom,
-- cf. 00051) et gardée par l'ancienne valeur : une correction admin
-- postérieure n'est jamais écrasée.
-- ============================================================

UPDATE public.map_artists SET country = 'GB', flag = '🇬🇧'
 WHERE id = 'mb-37b2cb82-ef79-4d46-a184-a549450aa231' AND country = 'US'; -- 21 Savage, London (US → GB)

UPDATE public.map_artists SET country = 'ZA', flag = '🇿🇦'
 WHERE id = 'mb-9c14317c-87b9-4f7c-a5a5-80add17a1709' AND country = 'DE'; -- Alice Phoebe Lou, Cape Town (DE → ZA)

UPDATE public.map_artists SET country = 'BE', flag = '🇧🇪'
 WHERE id = 'mb-ce0724ab-2d63-415b-bbb1-839f97bb771a' AND country = 'CA'; -- Apashe, Brussels (CA → BE)

UPDATE public.map_artists SET country = 'ML', flag = '🇲🇱'
 WHERE id = 'mb-cf580d82-3f3e-4b86-8874-7e0fbe794f01' AND country = 'FR'; -- Aya Nakamura, Bamako (FR → ML)

UPDATE public.map_artists SET country = 'GA', flag = '🇬🇦'
 WHERE id = 'mb-e33f7e19-debb-47a1-b33f-5c43cd25862d' AND country = 'FR'; -- Benjamin Epps, Libreville (FR → GA)

UPDATE public.map_artists SET country = 'AO', flag = '🇦🇴'
 WHERE id = 'mb-bd8badad-a9f6-43e7-a317-791d8a2c07b5' AND country IS NULL; -- C4 Pedro, Luanda (sans pays → AO)

UPDATE public.map_artists SET country = 'SN', flag = '🇸🇳'
 WHERE id = 'mb-697eaf40-f43b-4c19-9269-4bf52536f1a3' AND country = 'US'; -- Carole Fredericks, Dakar (US → SN)

UPDATE public.map_artists SET country = 'EG', flag = '🇪🇬'
 WHERE id = 'mb-1598ccda-b164-4bff-9821-f9ff5a8587a8' AND country = 'FR'; -- Dalida, Cairo (FR → EG)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-71ff695e-896a-4043-aea4-93eadde08d09' AND country = 'BE'; -- Damso, Kinshasa (BE → CD)

UPDATE public.map_artists SET country = 'ZA', flag = '🇿🇦'
 WHERE id = 'mb-b932f5eb-dd3d-479d-b2a0-694cb61327bb' AND country = 'GB'; -- Daniel Hope, Durban (GB → ZA)

UPDATE public.map_artists SET country = 'TN', flag = '🇹🇳'
 WHERE id = 'mb-f54452c0-5af9-47a2-ac07-ac46ce45cbe2' AND country = 'FR'; -- Dany Brillant, Tunis (FR → TN)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-dfdd8455-3dec-4205-9aec-d270c28fc6b0' AND country = 'FR'; -- Despo Rutti, Kinshasa (FR → CD)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-f2b1b3f0-f78b-4d80-a3f4-97efc41fecb9' AND country = 'BE'; -- Eikiro, Kinshasa (BE → CD)

UPDATE public.map_artists SET country = 'CM', flag = '🇨🇲'
 WHERE id = 'mb-4d434e7a-f549-4656-9c82-8309a707a93b' AND country = 'FR'; -- Elh Kmer, Yaoundé (FR → CM)

UPDATE public.map_artists SET country = 'MA', flag = '🇲🇦'
 WHERE id = 'mb-6aed0a74-92a7-47e6-97d1-7b6a72afec4b' AND country = 'CA'; -- Faouzia, Casablanca (CA → MA)

UPDATE public.map_artists SET country = 'CG', flag = '🇨🇬'
 WHERE id = 'mb-e6e76e37-2c47-46d1-aee4-a88357270db9' AND country = 'FR'; -- G-Live, Brazzaville (FR → CG)

UPDATE public.map_artists SET country = 'ZA', flag = '🇿🇦'
 WHERE id = 'mb-b2087e7c-2133-432e-bd9c-a1c5de5a6320' AND country = 'US'; -- Gary Barber, Johannesburg (US → ZA)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-b2fbd053-4380-412c-95d2-35c6da8f1011' AND country = 'FR'; -- GIMS, Kinshasa (FR → CD)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-e7609cf3-0b87-4da4-9ece-624f81005b71' AND country = 'FR'; -- Green Money, Kinshasa (FR → CD)

UPDATE public.map_artists SET country = 'ZA', flag = '🇿🇦'
 WHERE id = 'mb-506aa5b0-c6fb-4a69-8dd3-f06a369d5abc' AND country = 'DE'; -- Howard Carpendale, Durban (DE → ZA)

UPDATE public.map_artists SET country = 'CM', flag = '🇨🇲'
 WHERE id = 'mb-889693ef-6f88-4f87-8e42-1efa2c673b79' AND country = 'FR'; -- Irma, Douala (FR → CM)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-7483ddf0-033b-4ea4-a1eb-40e74c74c2d4' AND country = 'FR'; -- Jo le Balafré, Kinshasa (FR → CD)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-25f82916-5b66-4c06-a606-d291dc7b23cb' AND country = 'FR'; -- Jungeli, Kinshasa (FR → CD)

UPDATE public.map_artists SET country = 'CI', flag = '🇨🇮'
 WHERE id = 'mb-81920682-bb79-4b62-afa8-fe8dece0227c' AND country = 'FR'; -- Kaaris, Abidjan (FR → CI)

UPDATE public.map_artists SET country = 'KE', flag = '🇰🇪'
 WHERE id = 'mb-14a78189-c93d-44e1-b014-2c46912c9c33' AND country IS NULL; -- Kamore, Nairobi (sans pays → KE)

UPDATE public.map_artists SET country = 'KE', flag = '🇰🇪'
 WHERE id = 'mb-4c856249-9d81-4714-8913-15d8222d6559' AND country = 'GB'; -- Lil Wrld, Nairobi (GB → KE)

UPDATE public.map_artists SET country = 'SN', flag = '🇸🇳'
 WHERE id = 'mb-6eed9bd0-241b-4ce9-9008-6e8bb45400fa' AND country = 'CV'; -- Manu Lima, Dakar (CV → SN)

UPDATE public.map_artists SET country = 'CG', flag = '🇨🇬'
 WHERE id = 'mb-b97c2e1b-ee74-42e0-90dd-fdcd5858dc0e' AND country = 'DE'; -- Niasony, Brazzaville (DE → CG)

UPDATE public.map_artists SET country = 'CI', flag = '🇨🇮'
 WHERE id = 'mb-07f9fb91-1147-4532-a522-ac36dacd1c72' AND country = 'CD'; -- Papa Wemba, Abidjan (CD → CI)

UPDATE public.map_artists SET country = 'CG', flag = '🇨🇬'
 WHERE id = 'mb-d26817d3-9b70-432f-ab90-6b3928028048' AND country = 'FR'; -- Passi, Brazzaville (FR → CG)

UPDATE public.map_artists SET country = 'CM', flag = '🇨🇲'
 WHERE id = 'mb-324cf6ef-2a29-483b-b7d8-8a1a534079a5' AND country = 'FR'; -- Pit Baccardi, Yaoundé (FR → CM)

UPDATE public.map_artists SET country = 'EG', flag = '🇪🇬'
 WHERE id = 'mb-dc5531f9-e25d-4397-bb03-133f5f1d5ad9' AND country = 'FR'; -- Richard Anthony, Cairo (FR → EG)

UPDATE public.map_artists SET country = 'MG', flag = '🇲🇬'
 WHERE id = 'mb-f4a92aac-995b-47ab-80a5-33218a3e7823' AND country = 'FR'; -- Rohff, Antananarivo (FR → MG)

UPDATE public.map_artists SET country = 'CD', flag = '🇨🇩'
 WHERE id = 'mb-28dd4e98-4b84-4497-ab08-02a54740ccc1' AND country = 'FR'; -- Roshi, Kinshasa (FR → CD)

UPDATE public.map_artists SET country = 'NG', flag = '🇳🇬'
 WHERE id = 'mb-3c6a1239-9858-4ec6-8bf2-208fd2659c68' AND country = 'GB'; -- Sade Adu, Ibadan (GB → NG)

UPDATE public.map_artists SET country = 'MZ', flag = '🇲🇿'
 WHERE id = 'mb-99f963ed-a80a-4d15-9be3-848c58b429fb' AND country = 'CA'; -- Samito, Maputo (CA → MZ)

UPDATE public.map_artists SET country = 'CG', flag = '🇨🇬'
 WHERE id = 'mb-72606edb-f2e5-4a30-be77-5c98d891f9dc' AND country IS NULL; -- Siboy, Brazzaville (sans pays → CG)

UPDATE public.map_artists SET country = 'DZ', flag = '🇩🇿'
 WHERE id = 'mb-0f7a9866-5644-4a45-9781-b87e60eb3269' AND country = 'FR'; -- Souad Massi, Algiers (FR → DZ)

UPDATE public.map_artists SET country = 'ZW', flag = '🇿🇼'
 WHERE id = 'mb-e1811d3a-4631-4bfe-9b42-d0418524137e' AND country = 'AU'; -- Tkay Maidza, Harare (AU → ZW)

UPDATE public.map_artists SET country = 'SN', flag = '🇸🇳'
 WHERE id = 'mb-74a48e30-37f9-40fb-a30f-116c83f1e773' AND country = 'FR'; -- Tom Frager, Dakar (FR → SN)

UPDATE public.map_artists SET country = 'TG', flag = '🇹🇬'
 WHERE id = 'mb-dedfd6ff-6687-454e-8dc4-b0e35f4fb0dd' AND country = 'FR'; -- Vaudou Game, Lomé (FR → TG)

UPDATE public.map_artists SET country = 'CG', flag = '🇨🇬'
 WHERE id = 'mb-60045c49-ce7b-46e5-ad2e-cf6a6976752d' AND country = 'FR'; -- Wilson, Brazzaville (FR → CG)
