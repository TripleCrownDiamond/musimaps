-- ============================================================
-- 00064 — Historique des notifications
-- - notifications_delete_own : chacun supprime ses propres notifications
--   (aucune politique DELETE n'existait : l'historique était indélébile).
-- - notifications.ref : clé de dédoublonnage d'une alerte personnelle
--   (identifiant du badge), unique par compte et par type.
-- - notify_self : alerte pour le compte connecté UNIQUEMENT, limitée au
--   type 'achievement'. L'insertion directe reste réservée à l'admin.
--   Une même clé n'est jamais insérée deux fois, même si le web et le
--   mobile débloquent le badge au même moment.
-- ============================================================

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_type_ref_idx
  ON public.notifications (user_id, type, ref)
  WHERE ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_self(
  p_type    text,
  p_ref     text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_type IS DISTINCT FROM 'achievement' THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;
  IF coalesce(length(p_ref), 0) NOT BETWEEN 1 AND 64
     OR coalesce(length(p_message), 0) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  INSERT INTO public.notifications (user_id, type, ref, message)
  VALUES (auth.uid(), p_type, p_ref, p_message)
  ON CONFLICT (user_id, type, ref) WHERE ref IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_self(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_self(text, text, text) TO authenticated;
