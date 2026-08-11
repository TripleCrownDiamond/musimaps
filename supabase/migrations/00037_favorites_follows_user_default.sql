-- ============================================================
-- 00037 — user_id par défaut sur favorites et follows
-- ------------------------------------------------------------
-- Le client insère { artist_id } sans user_id : la policy
-- `WITH CHECK (auth.uid() = user_id)` rejetait l'insert (403)
-- car user_id était NULL. On pose DEFAULT auth.uid() pour que
-- l'utilisateur connecté remplisse automatiquement sa ligne.
-- ============================================================

ALTER TABLE public.favorites
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.follows
  ALTER COLUMN user_id SET DEFAULT auth.uid();
