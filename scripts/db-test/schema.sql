-- ============================================================
-- Socle minimal façon Supabase pour les tests SQL (scripts/db-test).
--
-- Rôles anon / authenticated / service_role, auth.uid() et auth.role()
-- lus depuis les claims JWT comme sur Supabase. La table map_artists
-- d'origine, is_admin() et la politique d'insertion publique ne sont pas
-- dans les migrations : ce sont des reconstitutions depuis les ALTER TABLE
-- et politiques du dépôt. lat/lng sont laissés NULLables pour couvrir la
-- branche « ligne sans coordonnées ».
-- ============================================================

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE other_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(COALESCE(
    current_setting('request.jwt.claim.sub', true),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(COALESCE(
    current_setting('request.jwt.claim.role', true),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  ), '')::text
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
CREATE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text,
  city text
);

-- 00056 ajoute waitlist.district.
CREATE TABLE public.waitlist (id bigserial PRIMARY KEY);

CREATE TABLE public.map_artists (
  id text PRIMARY KEY,
  name text NOT NULL,
  genre text,
  city text,
  country text,
  flag text,
  lat double precision,
  lng double precision,
  bio text,
  source text,
  image text,
  cover text,
  followers text, -- 00055 (district est ajouté par 00056 elle-même)
  platforms jsonb NOT NULL DEFAULT '{}',
  socials jsonb NOT NULL DEFAULT '{}',
  verified boolean NOT NULL DEFAULT false,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "map_artists_select_public" ON public.map_artists FOR SELECT USING (true);
-- Politique d'insertion publique supposée (map_artists_insert_public, hors dépôt).
CREATE POLICY "map_artists_insert_public" ON public.map_artists FOR INSERT WITH CHECK (true);
-- 00016
CREATE POLICY "map_artists_update_admin" ON public.map_artists FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "map_artists_update_owner" ON public.map_artists FOR UPDATE
  USING (claimed_by = auth.uid()) WITH CHECK (claimed_by = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.map_artists TO anon, authenticated;
GRANT ALL ON public.map_artists TO service_role;

-- 00032 : synchro du profil à la revendication.
CREATE OR REPLACE FUNCTION public.sync_claimed_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.claimed_by IS NOT NULL AND (OLD.claimed_by IS NULL OR OLD.claimed_by IS DISTINCT FROM NEW.claimed_by) THEN
    UPDATE public.profiles
      SET display_name = coalesce(NULLIF(display_name, ''), NEW.name),
          city = coalesce(NULLIF(city, ''), NEW.city)
      WHERE id = NEW.claimed_by;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_map_artists_sync_claimed
  AFTER UPDATE OF claimed_by ON public.map_artists
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_claimed_profile();
