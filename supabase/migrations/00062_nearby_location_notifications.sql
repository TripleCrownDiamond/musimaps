-- 00062 — notification locale après autorisation de localisation.
-- Les coordonnées servent uniquement au calcul ; elles ne sont jamais
-- stockées dans notifications ni dans profiles.

CREATE OR REPLACE FUNCTION public.notify_nearby_location(
  p_lat       double precision,
  p_lng       double precision,
  p_label     text,
  p_city      text,
  p_country   text,
  p_message   text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL
     OR p_lat IS NULL OR p_lng IS NULL
     OR p_lat NOT BETWEEN -90 AND 90
     OR p_lng NOT BETWEEN -180 AND 180 THEN
    RETURN 0;
  END IF;

  -- Rayon volontairement borné côté serveur : la position précise du compte
  -- ne peut pas être transformée en requête globale par un client modifié.
  WITH nearby AS (
    SELECT m.id
    FROM public.map_artists m
    WHERE m.lat IS NOT NULL AND m.lng IS NOT NULL
      AND m.lat BETWEEN p_lat - (50.0 / 111.0) AND p_lat + (50.0 / 111.0)
      AND m.lng BETWEEN p_lng - (50.0 / (111.0 * GREATEST(0.25, cos(radians(p_lat)))))
                    AND p_lng + (50.0 / (111.0 * GREATEST(0.25, cos(radians(p_lat)))))
      AND 6371.0 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(p_lat)) * cos(radians(m.lat)) *
        cos(radians(m.lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(m.lat))
      ))) <= 50.0
  )
  SELECT count(*)::integer INTO v_count FROM nearby;

  IF v_count = 0 THEN RETURN 0; END IF;

  -- Une seule alerte par zone et par jour, même si l'utilisateur recharge les
  -- deux surfaces ou réautorise la permission.
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = auth.uid()
      AND n.type = 'nearby'
      AND coalesce(n.city, '') = coalesce(NULLIF(p_city, ''), '')
      AND coalesce(n.country, '') = coalesce(NULLIF(p_country, ''), '')
      AND n.created_at > now() - interval '1 day'
  ) THEN
    RETURN v_count;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, artist_id, artist_name, city, country, message
  ) VALUES (
    auth.uid(), 'nearby', NULL, NULL,
    NULLIF(p_city, ''), NULLIF(p_country, ''),
    NULLIF(p_message, '')
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_nearby_location(double precision, double precision, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_nearby_location(double precision, double precision, text, text, text, text) TO authenticated;
