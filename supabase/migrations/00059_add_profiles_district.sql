-- 00059_add_profiles_district.sql
-- Ajoute la colonne `district` à la table `profiles` pour que
-- l'artiste puisse enregistrer son quartier dans son profil perso.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS district text;
