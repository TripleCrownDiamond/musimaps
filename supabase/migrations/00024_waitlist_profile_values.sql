-- ============================================================
-- 00024 — Alignement des valeurs de profil waitlist
-- La table live (créée par l'ancienne app) exigeait
-- profile IN ('user','artist') alors que tout le code
-- (web, mobile, admin) écrit 'artiste' | 'amateur'.
-- On accepte les deux jeux de valeurs pour ne rien casser.
-- ============================================================

ALTER TABLE public.waitlist
  DROP CONSTRAINT IF EXISTS waitlist_profile_check;

ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_profile_check
  CHECK (profile IN ('artiste', 'amateur', 'user', 'artist'));
