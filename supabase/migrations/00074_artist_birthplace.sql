-- ============================================================
-- 00074 — Ville de naissance ≠ ville d'activité
--
-- Le pin d'un artiste porte la ville où l'on le trouve / l'écoute
-- (règle de curation Musimaps), mais la ville de NAISSANCE est une
-- donnée différente : Blaaz est né à Kano (Nigéria) et rappe à
-- Cotonou, Sahel La Cip est né à Bohicon et fait carrière à Cotonou.
-- Afficher « Né·e à … » quand elle diffère évite de falsifier une
-- biographie pour coller à une règle de carte.
--
-- La colonne est nullable et jamais remplie par le RPC pour un
-- artiste dont on ne l'a pas documentée : « ville inconnue » ne
-- devient jamais une naissance inventée.
-- ============================================================

ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS birthplace text;

COMMENT ON COLUMN public.map_artists.birthplace IS
  'Ville de naissance documentée (≠ ville d''activité du pin). NULL = non documentée.';

-- Backfill : uniquement les cas vérifiés (listes de curation N/O/B),
-- et seulement si la valeur est absente (idempotent).
UPDATE public.map_artists SET birthplace = v.birthplace
FROM (VALUES
  ('Blaaz',                  'Kano'),
  ('Sahel La Cip',           'Bohicon'),
  ('Kaysee Edge Montejano',  'Brazzaville'),
  ('Pépé Oléka',             'Badagry'),
  ('Mina Agossi',            'Besançon'),
  ('Cyano-Gêne',             'Marcory, Abidjan'),
  ('Sagbohan Danialou',      'Ekpè'),
  ('Mister Kam',             'Natitingou'),
  ('D-Blue',                 'Ifangni'),
  ('Sessimè',                'Covè'),
  ('G. G. Vikey',            'Athiémé'),
  ('Don Métok',              'Allada')
) AS v(name, birthplace)
WHERE map_artists.country = 'BJ'
  AND map_artists.name = v.name
  AND (map_artists.birthplace IS NULL OR map_artists.birthplace = '');
