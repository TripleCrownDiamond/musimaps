-- ============================================================
-- 00084 — Compteurs de 00083 : vraiment internes
--
-- 00083 faisait `REVOKE … FROM public` sur consume_rate_limit et
-- request_subject. Sur Supabase, les privilèges par défaut du schéma
-- public accordent EXECUTE à anon et authenticated EN PLUS de public :
-- le REVOKE ne les retirait pas. Constaté en production : un visiteur
-- appelait consume_rate_limit avec ses propres plafonds et pouvait
-- épuiser le compteur global de la liste d'attente ou des photos (déni
-- de service pour tous les autres).
--
-- Les fonctions d'accès publiques (consume_waitlist_slot,
-- consume_artist_image_upload, submit_waitlist) restent ouvertes : elles
-- tournent en SECURITY DEFINER et imposent leurs propres plafonds.
--
-- Idempotente.
-- ============================================================

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_subject() FROM public, anon, authenticated;
