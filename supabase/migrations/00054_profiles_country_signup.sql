-- ============================================================
-- 00054 — Profil : le pays choisi à l'inscription est perdu
-- Le trigger handle_new_user (00013/00020) ne copie que
-- display_name, city et role ; il oublie country (colonne
-- ajoutée en 00040). On le corrige.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, city, country, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'country',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'melomane')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
