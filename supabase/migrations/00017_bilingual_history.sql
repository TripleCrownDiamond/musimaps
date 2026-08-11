-- ============================================================
-- 00017 — Historique bilingue
-- Le site est bilingue : chaque section a une version FR (content)
-- et une version EN (content_en). L'historique et la restauration
-- ne géraient que le FR. Désormais :
--  - content_history archive content + content_en ensemble,
--  - publish_section archive les deux langues,
--  - restore_version restaure les deux langues d'un coup.
-- ============================================================

-- 1. Colonne EN dans l'historique (rétrocompatible : les anciennes
--    versions n'ont que le FR ; l'EN publié actuel est conservé).
ALTER TABLE public.content_history
  ADD COLUMN IF NOT EXISTS content_en JSONB;

-- 2. Publication : archive FR + EN dans la même version.
--    Publie dès qu'au moins un brouillon (FR ou EN) existe.
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

  -- Archive la version FR publiée + la version EN publiée.
  INSERT INTO public.content_history (key, content, content_en, published_at, created_by)
  VALUES (
    p_key,
    (SELECT content FROM public.site_content WHERE key = p_key),
    (SELECT content_en FROM public.site_content WHERE key = p_key),
    v_now,
    auth.jwt() ->> 'email'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_section(text) FROM anon;

-- 3. Restauration : restaure FR + EN ensemble (et en fait le brouillon).
CREATE OR REPLACE FUNCTION public.restore_version(p_key text, p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content jsonb;
  v_content_en jsonb;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Accès refusé');
  END IF;

  SELECT content, content_en INTO v_content, v_content_en
    FROM public.content_history
   WHERE id = p_version_id AND key = p_key;

  IF v_content IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Version introuvable');
  END IF;

  UPDATE public.site_content
     SET content = v_content,
         draft = v_content,
         content_en = COALESCE(v_content_en, content_en),
         draft_en = COALESCE(v_content_en, draft_en),
         published_at = v_now,
         updated_at = v_now
   WHERE key = p_key;

  INSERT INTO public.content_history (key, content, content_en, published_at, created_by)
  VALUES (p_key, v_content, v_content_en, v_now, auth.jwt() ->> 'email');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_version(text, uuid) FROM anon;
