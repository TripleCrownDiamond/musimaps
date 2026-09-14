-- ============================================================
-- 00063 — Couverture du profil de compte
--
-- L'avatar de compte existe déjà dans profiles.avatar_url (00046). La
-- couverture est une donnée du compte, distincte de map_artists.cover qui
-- appartient au profil artiste revendiqué.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;
