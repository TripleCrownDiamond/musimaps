-- ============================================================
-- 00053 — Lier un compte à son profil carte (claimed_by)
-- Problème : la conversion waitlist → carte ne posait jamais
-- claimed_by, et une ligne waitlist soumise AVANT la création du
-- compte gardait user_id NULL. Résultat : des profils « carte
-- seule » alors que l'artiste a un compte.
--
-- Ce fichier :
--   1. étend add_or_update_map_artist : payload `claimed_by`
--      optionnel (seul le user concerné ou un admin peut le poser) ;
--   2. ajoute link_waitlist_to_account() : un artiste connecté
--      rattache sa ligne waitlist (par email) puis son pin
--      déterministe waitlist-<email> à son compte ;
--   3. backfill : lignes waitlist liées par email + pins déjà
--      convertis rattachés au compte.
-- ============================================================

-- ------------------------------------------------------------
-- 1. add_or_update_map_artist — claimed_by optionnel et sécurisé
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_or_update_map_artist(p_artist jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_inserted boolean;
  v_claimed_by uuid;
BEGIN
  v_id := p_artist ->> 'id';
  -- Validation stricte du payload (exposé à anon) : lat/lng numériques
  -- et dans les bornes géographiques, pour éviter les 500 et les pins absurdes.
  IF v_id IS NULL
     OR (p_artist ->> 'name') IS NULL
     OR (p_artist ->> 'lat') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR (p_artist ->> 'lng') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR (p_artist ->> 'lat')::double precision NOT BETWEEN -90 AND 90
     OR (p_artist ->> 'lng')::double precision NOT BETWEEN -180 AND 180
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  -- claimed_by : ne peut être posé que par l'utilisateur concerné
  -- (auth.uid() = claimed_by) ou un admin. Un anon ne peut PAS
  -- revendiquer un profil à la volée.
  v_claimed_by := NULLIF(p_artist ->> 'claimed_by', '')::uuid;
  IF v_claimed_by IS NOT NULL
     AND NOT (public.is_admin() OR auth.uid() = v_claimed_by) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'claimed_by_forbidden');
  END IF;

  INSERT INTO public.map_artists (
    id, name, genre, city, country, flag, lat, lng, bio, source,
    platforms, socials, image, claimed_by, claimed_at
  )
  VALUES (
    v_id,
    p_artist ->> 'name',
    NULLIF(p_artist ->> 'genre', ''),
    NULLIF(p_artist ->> 'city', ''),
    NULLIF(p_artist ->> 'country', ''),
    NULLIF(p_artist ->> 'flag', ''),
    (p_artist ->> 'lat')::double precision,
    (p_artist ->> 'lng')::double precision,
    NULLIF(p_artist ->> 'bio', ''),
    COALESCE(NULLIF(p_artist ->> 'source', ''), 'musicbrainz'),
    COALESCE(p_artist -> 'platforms', '{}'::jsonb),
    COALESCE(p_artist -> 'socials', '{}'::jsonb),
    NULLIF(p_artist ->> 'image', ''),
    v_claimed_by,
    CASE WHEN v_claimed_by IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Enrichit sans écraser la curation : le nom existant (corrigé par
    -- l'admin ou l'artiste revendiquant) prime sur le nom du candidat.
    name      = COALESCE(NULLIF(public.map_artists.name, ''), EXCLUDED.name),
    genre     = COALESCE(EXCLUDED.genre, public.map_artists.genre),
    city      = COALESCE(EXCLUDED.city, public.map_artists.city),
    country   = COALESCE(EXCLUDED.country, public.map_artists.country),
    flag      = COALESCE(EXCLUDED.flag, public.map_artists.flag),
    lat       = EXCLUDED.lat,
    lng       = EXCLUDED.lng,
    bio       = COALESCE(EXCLUDED.bio, public.map_artists.bio),
    source    = EXCLUDED.source,
    image     = COALESCE(EXCLUDED.image, public.map_artists.image),
    platforms = COALESCE(public.map_artists.platforms, '{}'::jsonb)
                || COALESCE(EXCLUDED.platforms, '{}'::jsonb),
    socials   = COALESCE(public.map_artists.socials, '{}'::jsonb)
                || COALESCE(EXCLUDED.socials, '{}'::jsonb),
    claimed_by = COALESCE(EXCLUDED.claimed_by, public.map_artists.claimed_by),
    claimed_at = CASE
                   WHEN EXCLUDED.claimed_by IS NOT NULL
                   THEN COALESCE(public.map_artists.claimed_at, now())
                   ELSE public.map_artists.claimed_at
                 END
  RETURNING (xmax = 0) INTO v_inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'updated', NOT v_inserted,
    'claimedBy', v_claimed_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_or_update_map_artist(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.add_or_update_map_artist(jsonb) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. link_waitlist_to_account — l'artiste connecté rattache sa
--    ligne waitlist (par email) puis revendique son pin
--    déterministe waitlist-<email> (s'il existe déjà).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_waitlist_to_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := auth.jwt() ->> 'email';
  v_uid uuid := auth.uid();
  v_row record;
  v_pin text;
BEGIN
  IF v_uid IS NULL OR v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Sa ligne waitlist la plus récente (par email, insensible à la casse).
  SELECT id, map_artist_id INTO v_row
    FROM public.waitlist
   WHERE lower(email) = lower(v_email)
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'linked', false);
  END IF;

  -- Lie la ligne au compte si ce n'est pas déjà fait.
  IF (SELECT user_id FROM public.waitlist WHERE id = v_row.id) IS NULL THEN
    UPDATE public.waitlist SET user_id = v_uid WHERE id = v_row.id;
  END IF;

  -- Pin déterministe : waitlist-<email> (même logique que la conversion,
  -- sans le suffixe +alias du plus-addressing).
  v_pin := v_row.map_artist_id;
  IF v_pin IS NULL THEN
    v_pin := 'waitlist-' ||
             regexp_replace(lower(split_part(v_email, '+', 1)), '[^a-z0-9@._-]', '-', 'g');
  END IF;

  IF v_pin IS NOT NULL THEN
    UPDATE public.map_artists
       SET claimed_by = v_uid,
           claimed_at = COALESCE(claimed_at, now())
     WHERE id = v_pin
       AND claimed_by IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'linked', true, 'mapArtistId', v_pin);
END;
$$;

REVOKE ALL ON FUNCTION public.link_waitlist_to_account() FROM public;
GRANT EXECUTE ON FUNCTION public.link_waitlist_to_account() TO authenticated;

-- ------------------------------------------------------------
-- 3. Backfill — les données existantes
-- ------------------------------------------------------------
-- 3a. Lignes waitlist non liées dont l'email correspond à un compte.
UPDATE public.waitlist w
   SET user_id = u.id
  FROM auth.users u
 WHERE w.user_id IS NULL
   AND lower(w.email) = lower(u.email);

-- 3b. Pins déjà convertis (map_artist_id ou id déterministe) rattachés
--     au compte de la ligne waitlist.
UPDATE public.map_artists m
   SET claimed_by = w.user_id,
       claimed_at = COALESCE(m.claimed_at, now())
  FROM public.waitlist w
 WHERE m.claimed_by IS NULL
   AND w.user_id IS NOT NULL
   AND (m.id = w.map_artist_id
        OR m.id = 'waitlist-' ||
                  regexp_replace(lower(split_part(w.email, '+', 1)), '[^a-z0-9@._-]', '-', 'g'));
