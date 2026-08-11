-- ============================================================
-- 00046 — Avatar de compte : la photo envoyée via la page
-- « Demande de référencement » / /artistes doit apparaître sur
-- le profil du compte (navbar, dashboard), pas seulement dans
-- la waitlist. On ajoute profiles.avatar_url + un setter RLS.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.set_profile_avatar(p_url text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET avatar_url = p_url
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.set_profile_avatar(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_profile_avatar(text) TO authenticated;
