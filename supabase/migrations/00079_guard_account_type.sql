-- ============================================================
-- 00079 — Palier de compte (account_type) : plus d'auto-promotion
--
-- FAILLE. La politique profiles_update_own (USING/WITH CHECK
-- auth.uid() = id) ne filtre pas les colonnes : tout compte connecté
-- pouvait passer son propre account_type à 'premium' ou 'business'
-- par l'API REST, sans l'app. Les paliers payants débloquent les
-- réservations et les liens illimités (00029). Même trou dans le RPC
-- set_account_type (00029), qui acceptait 'premium' et 'business'
-- de n'importe qui, et dans profiles_insert_own (upsert).
--
-- RÈGLE.
--   - Un utilisateur ne peut que DESCENDRE à 'personal' (le bouton
--     « repasser en personnel » du dashboard reste fonctionnel).
--   - Monter en 'business' / 'premium' : admin (is_admin), service_role
--     (backend, futur webhook de paiement) ou connexion directe
--     (éditeur SQL, migrations).
--   - role, display_name, city… restent librement modifiables
--     (updateProfile({ role }) après une connexion Google / Apple).
--
-- Le trigger fait confiance à current_user hors anon / authenticated :
-- service_role, postgres… et toute fonction SECURITY DEFINER. Une
-- telle fonction qui écrit account_type DOIT donc faire son propre
-- contrôle — c'est ce que fait set_account_type ci-dessous.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_profile_account_type()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (défaut) : current_user est l'appelant réel.
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.account_type IS DISTINCT FROM 'personal' THEN
      RAISE EXCEPTION 'account_type_forbidden'
        USING ERRCODE = '42501',
              DETAIL = 'Un nouveau profil commence en personal.';
    END IF;
  ELSIF NEW.account_type IS DISTINCT FROM OLD.account_type
        AND NEW.account_type IS DISTINCT FROM 'personal' THEN
    RAISE EXCEPTION 'account_type_forbidden'
      USING ERRCODE = '42501',
            DETAIL = 'Passage en business / premium réservé à l''équipe.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_account_type() FROM public;

DROP TRIGGER IF EXISTS trg_profiles_guard_account_type ON public.profiles;
CREATE TRIGGER trg_profiles_guard_account_type
  BEFORE INSERT OR UPDATE OF account_type ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_account_type();

-- set_account_type (00029) tourne en SECURITY DEFINER : le trigger le
-- laisse passer, il applique donc la même règle lui-même. Montée en
-- palier : admin uniquement, en attendant l'offre payante
-- (ACCOUNT_UPGRADES_ENABLED = false côté app).
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
  IF p_type IS NULL OR p_type NOT IN ('personal', 'business', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_type');
  END IF;
  IF p_type <> 'personal' AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'upgrade_unavailable');
  END IF;
  UPDATE public.profiles SET account_type = p_type WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_account_type(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_account_type(text) TO authenticated;
