-- ============================================================
-- 00038 — Omah Lay migré du catalogue éditorial vers map_artists
-- ------------------------------------------------------------
-- Le globe mélangeait le catalogue (@musimaps/shared) et la table
-- map_artists. Les artistes du catalogue n'étant PAS dans la table,
-- la FK follows.artist_id -> map_artists(id) rejetait « Suivre »
-- (erreur 23503 / 409). On migre l'unique artiste catalogue restant
-- pour que tout pin du globe existe en base.
-- ============================================================

INSERT INTO public.map_artists (
  id, name, genre, city, country, flag, lat, lng, bio, source, verified
)
VALUES (
  'omah-lay',
  'Omah Lay',
  'Afrobeats',
  'Lagos',
  'Nigeria',
  '🇳🇬',
  6.5244,
  3.3792,
  'Auteur-compositeur à la voix feutrée, entre afrobeats atmosphérique, soul et pop nocturne.',
  'seed',
  true
)
ON CONFLICT (id) DO NOTHING;
