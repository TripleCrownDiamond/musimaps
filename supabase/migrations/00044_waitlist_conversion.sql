-- ============================================================
-- 00044 — Conversion waitlist → carte / compte (après lancement)
-- Permet de tracer la migration des gens de la liste d'attente :
--   - user_id       : le compte connecté qui a soumis la demande
--                     (lien waitlist ↔ compte, évite de redemander
--                     la création d'un compte).
--   - converted_at  : horodatage du passage à la carte (artiste)
--                     ou de l'envoi de l'invitation (amateur).
--   - map_artist_id : le pin créé sur la carte depuis cette entrée.
-- ============================================================

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS map_artist_id text;

-- Index de conversion (l'admin filtre les entrées non converties).
CREATE INDEX IF NOT EXISTS waitlist_converted_idx
  ON public.waitlist (converted_at)
  WHERE converted_at IS NULL;
