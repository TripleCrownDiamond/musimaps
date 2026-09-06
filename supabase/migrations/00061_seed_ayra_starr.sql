-- ============================================================
-- 00061 — Ayra Starr (saisie « Arya Star ») au Nigeria
-- ------------------------------------------------------------
-- Les sources croisées identifient l'artiste sous son nom officiel
-- « Ayra Starr » (MusicBrainz + Wikipedia/Wikidata). La localisation de
-- scène demandée pour la carte est Lagos, Nigeria ; le pin n'est jamais posé
-- sur un centroïde de pays.
-- ============================================================

INSERT INTO public.map_artists (
  id, name, genre, city, country, flag, lat, lng, bio, source, verified
)
VALUES (
  'mb-c4ac4b97-2eac-46f6-85ae-f916c93847e4',
  'Ayra Starr',
  'Afrobeats',
  'Lagos',
  'NG',
  '🇳🇬',
  6.5244,
  3.3792,
  'Chanteuse et autrice-compositrice nigériane, connue pour son afrobeats teinté de pop et de R&B.',
  'musicbrainz',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  genre = EXCLUDED.genre,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  flag = EXCLUDED.flag,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  bio = COALESCE(NULLIF(public.map_artists.bio, ''), EXCLUDED.bio),
  source = EXCLUDED.source,
  verified = public.map_artists.verified OR EXCLUDED.verified;
