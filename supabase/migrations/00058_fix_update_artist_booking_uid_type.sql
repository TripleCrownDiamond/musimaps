-- 00058_fix_update_artist_booking_uid_type.sql
-- Fix : `claimed_by` est UUID mais la comparaison `claimed_by = v_uid::text`
-- provoque "operator does not exist: uuid = text" quand l'admin sauvegarde
-- un artiste depuis la page DiscoveredPage.
-- Solution : comparer les deux en UUID directement (sans cast).

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
    WHERE m.id = p_artist_id AND m.claimed_by = v_uid
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
