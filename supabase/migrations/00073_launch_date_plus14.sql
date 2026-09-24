-- ============================================================
-- 00073 — Repousse le compteur de lancement de 14 jours.
--
-- Le compte à rebours de la landing lit settings.launchDate (CMS). Le site
-- n'a pas encore d'abonnés à la date prévue (2026-09-25) : le lancement est
-- repoussé à 2026-10-09T12:00:00Z (+14 jours).
--
-- La mise à jour couvre les versions publiées ET les brouillons, FR et EN :
-- sinon l'aperçu admin réintroduirait l'ancienne date à la prochaine
-- publication. fetchContent fait déjà porter la date FR sur toutes les
-- langues ; on aligne content_en/draft_en pour rester cohérent.
-- ============================================================

UPDATE public.site_content
SET
  content    = jsonb_set(content,    '{launchDate}', '"2026-10-09T12:00:00Z"'::jsonb),
  content_en = jsonb_set(content_en, '{launchDate}', '"2026-10-09T12:00:00Z"'::jsonb),
  draft      = jsonb_set(draft,      '{launchDate}', '"2026-10-09T12:00:00Z"'::jsonb),
  draft_en   = jsonb_set(draft_en,   '{launchDate}', '"2026-10-09T12:00:00Z"'::jsonb),
  updated_at = now()
WHERE key = 'settings';
