-- Nettoyage général de la carte (30/10) : les fiches ont été recoupées avec
-- Deezer, Wikidata et Wikipédia, puis relues une à une. Aucun artiste ajouté.
-- La RPC publique préserve les bios et photos en base : d'où la migration.
-- Idempotent.

-- 1. Fiches retirées : identité invérifiable, ou photo et fans d'un autre
--    artiste (Metallica, Brandy, Barbra Streisand...), ou fiche vide.
DELETE FROM public.map_artists WHERE id IN (
  'mb-46803aef-f54e-4f0d-9bcf-279e00b3eab7', -- Metalokan
  'mb-60d34d0b-1d54-4bb8-900d-d601c02909d9', -- Jo Maka
  'mb-5e53f62e-0aff-4d91-8828-53be3406f6d2', -- Roy Amoo
  'mb-024b0fea-b885-486e-b0f7-fc204d349859', -- Rameyne
  'mb-4d1d0a46-8751-4fa9-beba-7efffee54dc8', -- Aeshis
  'mb-14a78189-c93d-44e1-b014-2c46912c9c33', -- Kamore
  'mb-4c856249-9d81-4714-8913-15d8222d6559', -- Lil Wrld
  'mb-56e06d99-dffe-4ae2-99dd-dcd9c88470df', -- Baudex
  'mb-f2b1b3f0-f78b-4d80-a3f4-97efc41fecb9', -- Eikiro
  'mb-dc0446fc-d192-4645-9499-12928e5d1c82', -- Léon Achard
  'mb-ed32c9ed-7f6b-4b5c-8c63-49b1f0d58465', -- Dou’sse
  'mb-1a01bb9c-b8f5-4b7c-8d86-afd7f96f0286', -- BGK Boyz
  'mb-49ca6c48-a352-470c-9bae-2121d80a33ec', -- Kheon
  'mb-9889e17f-545a-4d1e-af01-54d53ae45487', -- Emmanika
  'mb-50a5472c-7d23-4d0a-9535-37a6002d1244', -- Maphya
  'mb-ddf36011-68eb-40e0-a2b0-30b499e1a18e', -- Arnor
  'mb-2e7d12dd-b192-491a-812f-961b85e3ee72', -- ALL I AM
  'mb-7483ddf0-033b-4ea4-a1eb-40e74c74c2d4', -- Jo le Balafré
  'mb-b2087e7c-2133-432e-bd9c-a1c5de5a6320', -- Gary Barber
  'mb-e6e76e37-2c47-46d1-aee4-a88357270db9', -- G-Live
  'mb-2a2213e9-24e6-4b31-a8d1-b2ec5089b91a', -- Bra Myk
  'mb-1582445b-4505-4f85-bba1-711893e7828d', -- Chigul
  'mb-60045c49-ce7b-46e5-ad2e-cf6a6976752d', -- Wilson
  'tg-akadi' -- Akadi
);

-- 2. Bios sans rapport (homonymie, prénom, commune, film, album...) : vidées,
--    faute de bio fiable pour ces artistes.
UPDATE public.map_artists SET bio = '' WHERE id IN (
  'bj-bradley', -- Bradley
  'bj-billy-king', -- Billy King
  'bj-sona', -- Sona
  'bj-gopal-das', -- Gopal Das
  'bj-credo', -- Credo
  'mb-a4f07ac8-8e9f-44d7-a2bb-cbb77a2f5694', -- Zeynab
  'tg-kiko', -- Kiko
  'tg-shad', -- Shad
  'tg-juliano', -- Juliano
  'bj-ogassa', -- Ogassa
  'tg-hira', -- Hira
  'mb-e7609cf3-0b87-4da4-9ece-624f81005b71', -- Green Money
  'ci-revolution', -- Révolution
  'mb-ab886374-8565-4407-ac50-f76baadd4c7f', -- &ME
  'bj-ya-salam', -- Ya Salam
  'ci-vda' -- VDA
);

-- 3. Bonnes bios, reprises de la page Wikipédia de l'artiste.
UPDATE public.map_artists SET bio = $bio$Santana est un groupe américain de rock latino, originaire de San Francisco en Californie et constitué d'un nombre variable de musiciens entourant le guitariste Carlos Santana depuis la création de la formation en 1966. Comme Carlos Santana lui-même, il est réputé pour avoir popularisé le rock latino. Ces musiciens ont récolté au total huit Grammy Awards et trois Latino Grammy Awards.$bio$ WHERE id = 'us-santana';
UPDATE public.map_artists SET bio = $bio$Journey est un groupe américain de rock fondé en 1973 à San Francisco autour de Neal Schon et Gregg Rolie, anciens musiciens du groupe Santana. Le plus fort de son succès commercial a eu lieu entre 1978 et 1987, après quoi le groupe s'est temporairement séparé. Le groupe s'est ensuite reformé dans les années 1990 avec une succession de chanteurs.$bio$ WHERE id = 'us-journey';
UPDATE public.map_artists SET bio = $bio$Scott Hansen is an American musician, record producer, composer, and songwriter. He is known professionally as Tycho and as ISO50 for his photographic and design work. His music incorporates elements of downtempo, ambient, and electronic styles, often featuring analogue synthesizers and guitar. He is based in San Francisco.$bio$ WHERE id = 'us-tycho';
UPDATE public.map_artists SET bio = $bio$Primus est un groupe de rock américain, originaire d'El Sobrante en Californie. La formation connaît son apogée dans les années 1990. La musique de Primus est focalisée sur le jeu de basse de Les Claypool, accompagné de son chant, sorte de « curieux spectacle parallèle ».$bio$ WHERE id = 'us-primus';
UPDATE public.map_artists SET bio = $bio$Train est un groupe de rock alternatif américain, originaire de San Francisco, en Californie, formé en 1993. En 2017, le groupe comprend Patrick Monahan (chant), Luis Maldonado (guitare), Hector Maldonado, Drew Shoals (batterie) et Jerry Becker.$bio$ WHERE id = 'us-train';
UPDATE public.map_artists SET bio = $bio$Molare, de son vrai nom Soumahoro Mauryféré, est un chanteur ivoirien et co créateur du mouvement coupé-décalé. Il est propriétaire de 6 entreprises : M GROUP pour l’événementiel et différents festivals, 10 positif spécialisé dans l'implémentation évènementielle et M Prod pour la production artistique. Il entreprend dans le transport, l’agriculture via sa ferme et dans le bâtiment$bio$ WHERE id = 'ci-molare';
UPDATE public.map_artists SET bio = $bio$Josey, de son vrai nom Priscille Josée Gnakrou, est une chanteuse et auteure-compositrice ivoirienne, née le 29 juin 1989 à Abidjan, abordant un style musical entre coupé-décalé, afro-zouk, RnB contemporain, musique soul et afro-dance.$bio$ WHERE id = 'mb-bb73ae6e-9175-4ae8-8924-d7e41df2d4fc';
UPDATE public.map_artists SET bio = $bio$Black-K est rappeur ivoirien, auteur-compositeur, membre du groupe ivoirien Kiff No Beat. Il est né le 21 décembre 1993 à Agou dans le département d’Adzopé, en Côte d’Ivoire.$bio$ WHERE id = 'ci-black-k';
UPDATE public.map_artists SET bio = $bio$Alaska y Dinarama est un groupe espagnol de pop rock, originaire de Madrid, acitf entre 1982 et 1989. Une des chanteuses du groupe était Alaska. Le groupe atteint son plus haut niveau de popularité au milieu des années 1980. En 1989, après quatre albums studio et une compilation, il se sépare pour céder la place à la carrière solo de ses membres. Il est considéré comme l'un des groupes de pop espa$bio$ WHERE id = 'mb-32e5def8-6668-4459-bf21-643c0bde0de8';
UPDATE public.map_artists SET bio = $bio$Bobo Wê, de son vrai nom Baudouin Emmanuel Hounhalidé, né le 23 novembre 1998, est un rappeur, auteur-compositeur et performeur béninois. Il est associé au développement du style musical appelé « gangan trap », qui fusionne les sonorités traditionnelles du gangan avec le hip-hop et la trap.$bio$ WHERE id = 'bj-bobo-we';
UPDATE public.map_artists SET bio = $bio$King Ghetto Mike précédemment Ghetto Mike, connu sous le nom à l'état-civil de Chawki Kamel Dieudonné est un rappeur et auteur-compositeur-interprète, producteur togolais. Il chante principalement en anglais avec un style varié d'afrobeat.$bio$ WHERE id = 'tg-king-ghetto-mike';
UPDATE public.map_artists SET bio = $bio$Antoine Dougbé, surnommé « le Premier ministre du diable », né le 6 septembre 1947 à Abomey et mort le 20 septembre 1996 à Cotonou, est un auteur-compositeur béninois.$bio$ WHERE id = 'bj-antoine-dougbe';

-- 4. Photos et fans erronés remplacés par ceux du bon profil Deezer.
UPDATE public.map_artists SET image = 'https://cdn-images.dzcdn.net/images/artist/6001efdb15fb83b113f279ea2e73a10a/1000x1000-000000-80-0-0.jpg', followers = '220' WHERE id = 'mb-6eed9bd0-241b-4ce9-9008-6e8bb45400fa';
UPDATE public.map_artists SET image = 'https://cdn-images.dzcdn.net/images/artist/c7a5b121c3543a151409aeb579712548/1000x1000-000000-80-0-0.jpg', followers = '352' WHERE id = 'mb-99f963ed-a80a-4d15-9be3-848c58b429fb';
UPDATE public.map_artists SET image = 'https://cdn-images.dzcdn.net/images/artist/683dd8245df4ce62a37f833efabfbd5f/1000x1000-000000-80-0-0.jpg', followers = '835' WHERE id = 'tg-mic-flammez';
UPDATE public.map_artists SET image = 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Niasony_Live_02.jpg', followers = NULL WHERE id = 'mb-b97c2e1b-ee74-42e0-90dd-fdcd5858dc0e';
UPDATE public.map_artists SET image = NULL, followers = NULL WHERE id = 'mb-7c92abde-7cd4-4a5d-a995-81efb13dc025';

-- 5. Lien d'image Deezer vide (aucune photo) : la fiche affiche ses initiales.
UPDATE public.map_artists SET image = NULL WHERE image LIKE '%/images/artist//%';
