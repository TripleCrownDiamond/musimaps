-- ============================================================
-- 00039 — Restaure public.is_subscriber(text)
-- ------------------------------------------------------------
-- request_booking (SECURITY DEFINER) et le client (booking.ts)
-- appellent is_subscriber(email), mais cette fonction venait des
-- migrations 00001-00014 (absentes de ce repo) et n'existe PAS en
-- base → toute réservation échouait avec « function does not exist ».
-- La table subscribers (email, created_at) est bien présente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_subscriber(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscribers
    WHERE email = p_email
  )
$$;

REVOKE ALL ON FUNCTION public.is_subscriber(text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_subscriber(text) TO anon, authenticated;
