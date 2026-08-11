-- 00048_booking_plans_account.sql
-- Forfaits de réservation par artiste + bascule « réservable » sur la carte
-- + suppression complète du compte par l'utilisateur (web + mobile).

-- ------------------------------------------------------------
-- 1. map_artists.bookable — l'artiste accepte les réservations
-- ------------------------------------------------------------
ALTER TABLE public.map_artists ADD COLUMN IF NOT EXISTS bookable BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. booking_plans — catalogue de prestations d'un artiste
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_artist_id TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  duration      TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_plans_artist ON public.booking_plans (map_artist_id);

ALTER TABLE public.booking_plans ENABLE ROW LEVEL SECURITY;

-- Lecture publique : les forfaits s'affichent sur la fiche artiste.
DROP POLICY IF EXISTS "booking_plans_public_read" ON public.booking_plans;
CREATE POLICY "booking_plans_public_read"
  ON public.booking_plans FOR SELECT USING (true);

-- Écriture : aucun accès direct, tout passe par update_artist_booking
-- (SECURITY DEFINER, réservé à l'artiste revendiqué ou à l'admin).

-- ------------------------------------------------------------
-- 3. Lecture publique : réservable + forfaits d'un artiste
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_artist_booking(p_artist_id TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'bookable', m.bookable,
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'description', b.description,
        'price', b.price,
        'currency', b.currency,
        'duration', b.duration,
        'active', b.active
      ) ORDER BY b.created_at)
      FROM public.booking_plans b
      WHERE b.map_artist_id = m.id AND b.active
    ), '[]'::jsonb)
  )
  FROM public.map_artists m
  WHERE m.id = p_artist_id;
$$;

-- ------------------------------------------------------------
-- 4. Mise à jour par l'artiste revendiqué ou l'admin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_artist_booking(
  p_artist_id TEXT,
  p_bookable BOOLEAN,
  p_plans JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non connecté');
  END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.map_artists m
    WHERE m.id = p_artist_id AND m.claimed_by = v_uid::text
  )) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non autorisé');
  END IF;

  UPDATE public.map_artists
  SET bookable = COALESCE(p_bookable, false)
  WHERE id = p_artist_id;

  DELETE FROM public.booking_plans WHERE map_artist_id = p_artist_id;

  IF jsonb_typeof(p_plans) = 'array' AND jsonb_array_length(p_plans) > 0 THEN
    INSERT INTO public.booking_plans (map_artist_id, name, description, price, currency, duration, active)
    SELECT
      p_artist_id,
      plan->>'name',
      NULLIF(plan->>'description', ''),
      COALESCE(NULLIF(plan->>'price', '')::numeric, 0),
      COALESCE(NULLIF(plan->>'currency', ''), 'EUR'),
      NULLIF(plan->>'duration', ''),
      COALESCE((plan->>'active')::boolean, true)
    FROM jsonb_array_elements(p_plans) AS plan
    WHERE NULLIF(plan->>'name', '') IS NOT NULL;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ------------------------------------------------------------
-- 5. Suppression du compte par l'utilisateur (web + mobile)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := NULLIF(trim(p_email), '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non connecté');
  END IF;

  -- Réservations : la table bookings ne référence pas auth.users → par email.
  IF v_email IS NOT NULL THEN
    DELETE FROM public.bookings WHERE user_email = v_email;
  END IF;

  DELETE FROM public.follows WHERE user_id = v_uid;
  DELETE FROM public.artist_claims WHERE user_id = v_uid;
  DELETE FROM public.artist_views WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;
