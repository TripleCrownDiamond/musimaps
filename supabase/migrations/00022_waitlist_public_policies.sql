-- ============================================================
-- 00022 — Waitlist : rétablir l'insert/update public
-- Bug préexistant : la table live (créée par l'ancienne app) a
-- RLS activée mais SANS policy d'insert pour anon. Résultat :
-- toutes les inscriptions web/mobile échouaient en base (42501)
-- et tombaient silencieusement en localStorage. L'admin voyait
-- une waitlist vide. Cette migration rétablit les policies
-- prévues par 00003, de façon idempotente.
-- ============================================================

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_select_admin" ON public.waitlist;
CREATE POLICY "waitlist_select_admin"
  ON public.waitlist FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "waitlist_insert_public" ON public.waitlist;
CREATE POLICY "waitlist_insert_public"
  ON public.waitlist FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_update_public" ON public.waitlist;
CREATE POLICY "waitlist_update_public"
  ON public.waitlist FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_delete_admin" ON public.waitlist;
CREATE POLICY "waitlist_delete_admin"
  ON public.waitlist FOR DELETE
  USING (public.is_admin());
