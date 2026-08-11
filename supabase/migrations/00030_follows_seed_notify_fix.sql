-- ============================================================
-- 00030 — Correctifs 00029 : seed des follows + notify sécurisé
-- - On copie les favoris existants vers follows pour ne pas
--   faire chuter les compteurs d'abonnés au lancement.
-- - notify_discovery : ne notifie jamais « tout le monde » quand
--   la ville ou le genre de l'artiste est vide (LIKE '%%').
-- ============================================================

INSERT INTO public.follows (user_id, artist_id)
SELECT DISTINCT user_id, artist_id FROM public.favorites
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_discovery(
  p_artist_id text,
  p_artist_name text,
  p_genre text,
  p_city text,
  p_country text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Même ville (préférence de localisation déclarée dans le profil).
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT p.id, 'nearby', p_artist_id, p_artist_name, p_city, p_country,
         p_artist_name || ' est maintenant sur la carte — près de chez toi !'
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND NULLIF(p.city, '') IS NOT NULL
    AND NULLIF(p_city, '') IS NOT NULL
    AND lower(p.city) LIKE '%' || lower(p_city) || '%'
  ON CONFLICT DO NOTHING;

  -- 2) Genres préférés de l'utilisateur qui correspondent au genre.
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT p.id, 'preference', p_artist_id, p_artist_name, p_city, p_country,
         'Nouvel artiste ' || coalesce(p_genre, '') || ' à découvrir : ' || p_artist_name
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND NULLIF(p_genre, '') IS NOT NULL
    AND p.favorite_genres IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p.favorite_genres) g
      WHERE NULLIF(g, '') IS NOT NULL
        AND lower(g) LIKE '%' || lower(p_genre) || '%'
    )
  ON CONFLICT DO NOTHING;

  -- 3) Les abonnés des artistes de la même ville.
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT DISTINCT f.user_id, 'followed_artist', p_artist_id, p_artist_name, p_city, p_country,
         'Un artiste de ' || coalesce(p_city, 'la région') || ' vient d' || '''arriver : ' || p_artist_name
  FROM public.follows f
  JOIN public.map_artists ma ON ma.id = f.artist_id
  WHERE NULLIF(p_city, '') IS NOT NULL
    AND lower(coalesce(ma.city, '')) = lower(p_city)
    AND f.user_id <> auth.uid()
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_discovery(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_discovery(text, text, text, text, text) TO authenticated;
