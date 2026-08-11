-- ============================================================
-- 00015 : publication indépendante par langue
-- Le RPC publish_section exigeait un brouillon FR non vide pour
-- publier — l'édition d'un brouillon EN seul échouait. Désormais
-- on publie dès qu'au moins un brouillon (FR ou EN) existe, en
-- conservant la version publiée de l'autre langue si son brouillon
-- est vide. launchDate reste pilotée par la version FR.
-- ============================================================

CREATE OR REPLACE FUNCTION public.publish_section(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft jsonb;
  v_draft_en jsonb;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Accès refusé');
  END IF;

  SELECT draft, draft_en INTO v_draft, v_draft_en
    FROM public.site_content WHERE key = p_key;

  -- Un brouillon au moins (FR ou EN) doit exister.
  IF (v_draft IS NULL OR v_draft = '{}'::jsonb)
     AND (v_draft_en IS NULL OR v_draft_en = '{}'::jsonb) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Aucun brouillon à publier');
  END IF;

  UPDATE public.site_content
     SET content = CASE
           WHEN v_draft IS NOT NULL AND v_draft <> '{}'::jsonb THEN v_draft
           ELSE content
         END,
         content_en = CASE
           WHEN v_draft_en IS NOT NULL AND v_draft_en <> '{}'::jsonb THEN v_draft_en
           ELSE content_en
         END,
         published_at = v_now,
         updated_at = v_now
   WHERE key = p_key;

  -- On archive la version FR publiée (rétrocompatible avec restore_version).
  INSERT INTO public.content_history (key, content, published_at, created_by)
  VALUES (p_key, v_draft, v_now, auth.jwt() ->> 'email');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_section(text) FROM anon;
