-- ============================================================
-- 00016 — Découverte enrichie, revendication de profil, business
-- - map_artists : plateformes (YouTube/Spotify/Apple…), réseaux
--   sociaux, vérification, propriétaire revendiqué.
-- - artist_claims : demandes de revendication (l'artiste prouve
--   que le profil est le sien, l'admin approuve).
-- - profiles.account_type : 'personal' | 'business' (booking B2B).
-- - request_booking : autorise désormais les comptes business.
-- ============================================================

-- ------------------------------------------------------------
-- 1. map_artists — champs enrichis
-- ------------------------------------------------------------
ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS platforms jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS socials    jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verified   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- L'admin (et le propriétaire revendiqué) peut corriger les données.
DROP POLICY IF EXISTS "map_artists_update_admin" ON public.map_artists;
CREATE POLICY "map_artists_update_admin"
  ON public.map_artists FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "map_artists_update_owner" ON public.map_artists;
CREATE POLICY "map_artists_update_owner"
  ON public.map_artists FOR UPDATE
  USING (claimed_by = auth.uid())
  WITH CHECK (claimed_by = auth.uid());

-- ------------------------------------------------------------
-- 2. artist_claims — demandes de revendication
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artist_claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_artist_id TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID
);

ALTER TABLE public.artist_claims ENABLE ROW LEVEL SECURITY;

-- Lecture : ses propres demandes + admin.
DROP POLICY IF EXISTS "artist_claims_select_own" ON public.artist_claims;
CREATE POLICY "artist_claims_select_own"
  ON public.artist_claims FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Insertion : aucun insert direct — le RPC request_claim (SECURITY DEFINER)
-- est le seul chemin, il vérifie le rôle artiste et les doublons.
DROP POLICY IF EXISTS "artist_claims_insert_auth" ON public.artist_claims;
DROP POLICY IF EXISTS "artist_claims_insert_artist" ON public.artist_claims;
CREATE POLICY "artist_claims_insert_artist"
  ON public.artist_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_artist());

-- Mise à jour : admin uniquement.
DROP POLICY IF EXISTS "artist_claims_update_admin" ON public.artist_claims;
CREATE POLICY "artist_claims_update_admin"
  ON public.artist_claims FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 3. request_claim — un artiste connecté demande son profil
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_claim(
  p_map_artist_id text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := auth.jwt() ->> 'email';
  v_artist record;
  v_pending int;
BEGIN
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF NOT public.is_artist() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_artist');
  END IF;

  SELECT claimed_by INTO v_artist FROM public.map_artists WHERE id = p_map_artist_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'artist_not_found');
  END IF;
  IF v_artist.claimed_by IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  SELECT count(*) INTO v_pending FROM public.artist_claims
    WHERE map_artist_id = p_map_artist_id
      AND user_id = auth.uid()
      AND status = 'pending';
  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_requested');
  END IF;

  INSERT INTO public.artist_claims (map_artist_id, user_id, user_email, note)
  VALUES (p_map_artist_id, auth.uid(), v_email, NULLIF(p_note, ''));
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.request_claim(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_claim(text, text) TO authenticated;

-- ------------------------------------------------------------
-- 4. review_claim — l'admin approuve / refuse la revendication
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_claim(
  p_claim_id uuid,
  p_approve boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim record;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_claim FROM public.artist_claims WHERE id = p_claim_id;
  IF v_claim.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE public.artist_claims
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_claim_id;

  IF p_approve THEN
    -- L'artiste devient propriétaire du profil et il est vérifié.
    UPDATE public.map_artists
      SET claimed_by = v_claim.user_id,
          claimed_at = now(),
          verified = true
      WHERE id = v_claim.map_artist_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.review_claim(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.review_claim(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------
-- 5. profiles.account_type + is_business
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'personal'
  CHECK (account_type IN ('personal', 'business'));

CREATE OR REPLACE FUNCTION public.is_business()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND account_type = 'business'
  );
$$;

REVOKE ALL ON FUNCTION public.is_business() FROM public;
GRANT EXECUTE ON FUNCTION public.is_business() TO authenticated;

-- Bascule personal <-> business sur son propre compte.
CREATE OR REPLACE FUNCTION public.set_account_type(p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_type NOT IN ('personal', 'business') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_type');
  END IF;
  UPDATE public.profiles SET account_type = p_type WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_account_type(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_account_type(text) TO authenticated;

-- ------------------------------------------------------------
-- 6. request_booking : abonné OU compte business
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_booking(
  p_artist_id   text,
  p_artist_name text,
  p_event_type  text,
  p_event_date  text,
  p_flexible    boolean,
  p_city        text,
  p_country     text,
  p_address     text,
  p_budget_range  text,
  p_budget_amount text,
  p_audience_size text,
  p_message     text,
  p_contact_name  text,
  p_company     text,
  p_phone       text,
  p_website     text,
  p_instagram   text,
  p_linkedin    text,
  p_contact_prefs text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := auth.jwt() ->> 'email';
BEGIN
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  -- Abonné OU compte business : les deux peuvent réserver.
  IF NOT public.is_subscriber(v_email) AND NOT public.is_business() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_subscriber');
  END IF;

  INSERT INTO public.bookings (
    artist_id, artist_name, user_id, user_email,
    event_type, event_date, flexible_date,
    city, country, address,
    budget_range, budget_amount, audience_size, message,
    contact_name, company, phone, website, instagram, linkedin,
    contact_prefs, status
  ) VALUES (
    p_artist_id, p_artist_name, auth.uid(), v_email,
    p_event_type, p_event_date, COALESCE(p_flexible, false),
    NULLIF(p_city, ''), NULLIF(p_country, ''), NULLIF(p_address, ''),
    NULLIF(p_budget_range, ''), NULLIF(p_budget_amount, ''),
    NULLIF(p_audience_size, ''), NULLIF(p_message, ''),
    NULLIF(p_contact_name, ''), NULLIF(p_company, ''),
    NULLIF(p_phone, ''), NULLIF(p_website, ''),
    NULLIF(p_instagram, ''), NULLIF(p_linkedin, ''),
    COALESCE(p_contact_prefs, '{}'), 'pending'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.request_booking(
  text, text, text, text, boolean, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text[]
) FROM public;
GRANT EXECUTE ON FUNCTION public.request_booking(
  text, text, text, text, boolean, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text[]
) TO authenticated;
