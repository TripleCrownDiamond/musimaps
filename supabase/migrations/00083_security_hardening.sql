-- ============================================================
-- 00083 — Durcissement : écritures publiques bornées et vérifiées
--
-- FAILLES CORRIGÉES (audit du 28 octobre 2026)
--   1. map_artists : n'importe quel visiteur pouvait poser un nombre
--      illimité de pins (RPC add_or_update_map_artist ouvert à anon,
--      politique d'insertion publique), avec des liens `javascript:` ou
--      `data:` ; un insert direct pouvait arriver déjà « vérifié » ou
--      revendiqué, et le propriétaire d'un pin pouvait se vérifier
--      lui-même (map_artists_update_owner ne filtre pas les colonnes).
--   2. notify_discovery : tout compte connecté envoyait à tous les
--      utilisateurs d'une ville ou d'un genre une alerte au texte libre
--      (le nom de l'artiste venait du client).
--   3. notify_artist_action : messages au texte libre, sans limite.
--   4. waitlist : UPDATE ouvert à tous (USING true) — on pouvait
--      réécrire la demande d'un autre, ou la rattacher à son compte.
--   5. artist-images : envoi anonyme illimité dans un bucket public.
--
-- PRINCIPES
--   - Les chemins légitimes ne changent pas : la découverte (web et
--     mobile, connecté ou non) pose toujours ses pins, la redécouverte
--     d'un artiste existant ne compte pas dans le quota.
--   - Le visiteur est identifié par son compte, sinon par son IP
--     (request_subject) ; chaque compteur a aussi un plafond global.
--   - Admin, service_role et connexions directes (scripts, migrations)
--     ne sont jamais limités.
--   - Les fonctions SECURITY DEFINER existantes (review_claim,
--     link_waitlist_to_account, update_claimed_profile…) gardent leur
--     droit d'écrire claimed_by / verified : elles font leurs propres
--     contrôles. Le garde-fou de colonnes ne vise que les écritures
--     DIRECTES des rôles anon / authenticated (comme 00079).
--
-- Idempotente : rejouable sans effet de bord.
-- Tests : npm run test:db -- security (scripts/db-test/security-hardening.test.mjs)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Compteurs quotidiens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket  text    NOT NULL,
  subject text    NOT NULL,
  day     date    NOT NULL DEFAULT current_date,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, day)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Aucune politique : seules les fonctions ci-dessous y écrivent.
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

/**
 * Qui appelle ? « user:<uuid> » pour un compte, sinon « ip:<adresse> ».
 * cf-connecting-ip est posé par Cloudflare devant l'API Supabase et
 * écrase toute valeur envoyée par le client ; x-forwarded-for ne sert
 * qu'en dernier recours (son premier élément peut être forgé).
 */
CREATE OR REPLACE FUNCTION public.request_subject()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_ip text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN 'user:' || auth.uid()::text;
  END IF;
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;
  v_ip := COALESCE(
    NULLIF(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    NULLIF(btrim(v_headers ->> 'x-real-ip'), ''),
    NULLIF(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '')
  );
  RETURN 'ip:' || COALESCE(left(v_ip, 64), 'inconnue');
END;
$$;
REVOKE ALL ON FUNCTION public.request_subject() FROM public;

/**
 * Consomme une unité du compteur `p_bucket`. `false` = limite atteinte.
 * L'appelant est compté AVANT le global : un seul visiteur ne peut pas
 * épuiser le plafond commun au-delà de sa propre limite. Une IP inconnue
 * n'a que le plafond global. Les administrateurs ne sont jamais limités.
 * Interne : appelée par les triggers et les fonctions d'accès ci-dessous.
 */
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket text,
  p_subject_limit integer,
  p_global_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text := public.request_subject();
  v_count integer;
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  IF v_subject <> 'ip:inconnue' THEN
    INSERT INTO public.rate_limits (bucket, subject, day, count)
    VALUES (p_bucket, v_subject, current_date, 1)
    ON CONFLICT (bucket, subject, day) DO UPDATE SET count = public.rate_limits.count + 1
    RETURNING count INTO v_count;
    IF v_count > p_subject_limit THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO public.rate_limits (bucket, subject, day, count)
  VALUES (p_bucket, '*', current_date, 1)
  ON CONFLICT (bucket, subject, day) DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Ménage occasionnel : une semaine d'historique suffit.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE day < current_date - 7;
  END IF;

  RETURN v_count <= p_global_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM public;

/** Lien sûr : pas de schéma exécutable (javascript:, data:, vbscript:). */
CREATE OR REPLACE FUNCTION public.is_safe_link(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_value IS NULL
      OR (length(p_value) <= 2048
          AND p_value !~* '^[[:space:][:cntrl:]]*(javascript|data|vbscript|file):')
$$;
GRANT EXECUTE ON FUNCTION public.is_safe_link(text) TO anon, authenticated, service_role;

/** Objet de liens { plateforme: url } : ≤ 40 clés, valeurs texte sûres. */
CREATE OR REPLACE FUNCTION public.are_safe_links(p_links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_links IS NULL
      OR jsonb_typeof(p_links) <> 'object'
      OR ((SELECT count(*) FROM jsonb_object_keys(p_links)) <= 40
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_each(p_links) e
             WHERE jsonb_typeof(e.value) NOT IN ('string', 'null')
                OR NOT public.is_safe_link(e.value #>> '{}')
          ))
$$;
GRANT EXECUTE ON FUNCTION public.are_safe_links(jsonb) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. map_artists
-- ------------------------------------------------------------

/**
 * Écritures DIRECTES d'anon / authenticated (politiques RLS, hors RPC) :
 *   - INSERT : jamais vérifié ni revendiqué d'emblée ;
 *   - UPDATE : verified, claimed_by, claimed_at et followers sont
 *     réservés à l'équipe (le propriétaire édite son profil, pas son
 *     badge). Les fonctions SECURITY DEFINER passent (current_user est
 *     alors leur propriétaire) : elles font leurs propres contrôles.
 * SECURITY INVOKER (défaut) : current_user est l'appelant réel.
 */
CREATE OR REPLACE FUNCTION public.guard_map_artist_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verified := false;
    NEW.claimed_by := NULL;
    NEW.claimed_at := NULL;
  ELSIF NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
     OR NEW.followers IS DISTINCT FROM OLD.followers THEN
    RAISE EXCEPTION 'map_artist_column_forbidden'
      USING ERRCODE = '42501',
            DETAIL = 'Vérification, revendication et abonnés sont gérés par l''équipe.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_map_artist_columns() FROM public;

DROP TRIGGER IF EXISTS trg_map_artists_guard_columns ON public.map_artists;
CREATE TRIGGER trg_map_artists_guard_columns
  BEFORE INSERT OR UPDATE ON public.map_artists
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_map_artist_columns();

/**
 * Contenu venu du public (JWT anon / authenticated, y compris via le RPC
 * add_or_update_map_artist) : longueurs bornées, liens et image sans
 * schéma exécutable. Seuls les champs modifiés sont contrôlés : une
 * ligne historique hors normes reste éditable sur ses autres champs.
 */
CREATE OR REPLACE FUNCTION public.validate_map_artist_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_new boolean := TG_OP = 'INSERT';
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF (v_new OR NEW.name IS DISTINCT FROM OLD.name)
     AND (NEW.name IS NULL OR length(btrim(NEW.name)) NOT BETWEEN 1 AND 200)
  OR (v_new OR NEW.bio IS DISTINCT FROM OLD.bio) AND length(NEW.bio) > 5000
  OR (v_new OR NEW.genre IS DISTINCT FROM OLD.genre) AND length(NEW.genre) > 120
  OR (v_new OR NEW.city IS DISTINCT FROM OLD.city) AND length(NEW.city) > 200
  OR (v_new OR NEW.country IS DISTINCT FROM OLD.country) AND length(NEW.country) > 120
  OR (v_new OR NEW.image IS DISTINCT FROM OLD.image) AND NOT public.is_safe_link(NEW.image)
  OR (v_new OR NEW.platforms IS DISTINCT FROM OLD.platforms) AND NOT public.are_safe_links(NEW.platforms)
  OR (v_new OR NEW.socials IS DISTINCT FROM OLD.socials) AND NOT public.are_safe_links(NEW.socials)
  THEN
    RAISE EXCEPTION 'invalid_payload'
      USING ERRCODE = '22023',
            DETAIL = 'Champ trop long ou lien non autorisé.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_map_artist_content() FROM public;

DROP TRIGGER IF EXISTS trg_map_artists_validate_content ON public.map_artists;
CREATE TRIGGER trg_map_artists_validate_content
  BEFORE INSERT OR UPDATE ON public.map_artists
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_map_artist_content();

/**
 * Quota de NOUVEAUX pins venus du public : 40 par visiteur et par jour
 * (une ville vide en découvre au plus CITY_DISCOVERY_LIMIT = 10), 500
 * au total. AFTER INSERT : une redécouverte (ON CONFLICT DO UPDATE)
 * n'insère rien et ne compte donc pas.
 */
CREATE OR REPLACE FUNCTION public.limit_map_artist_inserts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     AND NOT public.consume_rate_limit('map_artist_insert', 40, 500) THEN
    RAISE EXCEPTION 'rate_limited'
      USING ERRCODE = 'P0001',
            DETAIL = 'Trop de nouveaux artistes ajoutés aujourd''hui.';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.limit_map_artist_inserts() FROM public;

DROP TRIGGER IF EXISTS trg_map_artists_limit_inserts ON public.map_artists;
CREATE TRIGGER trg_map_artists_limit_inserts
  AFTER INSERT ON public.map_artists
  FOR EACH ROW
  EXECUTE FUNCTION public.limit_map_artist_inserts();

-- ------------------------------------------------------------
-- 3. Notifications
-- ------------------------------------------------------------

/**
 * Même signature (les apps installées l'appellent encore), mais les
 * paramètres texte sont IGNORÉS : nom, genre, ville et pays viennent de
 * la ligne map_artists. L'alerte ne part que pour un artiste réellement
 * ajouté il y a moins de 15 minutes, et une seule fois par artiste.
 */
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
DECLARE
  v_artist record;
BEGIN
  SELECT id, name, genre, city, country INTO v_artist
    FROM public.map_artists
   WHERE id = p_artist_id
     AND created_at > now() - interval '15 minutes';
  IF v_artist.id IS NULL THEN
    RETURN;
  END IF;

  -- Verrou par artiste : deux appels simultanés (web + mobile) ne
  -- dupliquent pas l'envoi.
  PERFORM pg_advisory_xact_lock(hashtext('notify_discovery:' || v_artist.id));
  IF EXISTS (
    SELECT 1 FROM public.notifications
     WHERE artist_id = v_artist.id
       AND type IN ('nearby', 'preference', 'followed_artist')
  ) THEN
    RETURN;
  END IF;

  -- 1) Même ville (préférence de localisation déclarée dans le profil).
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT p.id, 'nearby', v_artist.id, v_artist.name, v_artist.city, v_artist.country,
         v_artist.name || ' est maintenant sur la carte — près de chez toi !'
  FROM public.profiles p
  WHERE p.id IS DISTINCT FROM auth.uid()
    AND NULLIF(p.city, '') IS NOT NULL
    AND NULLIF(v_artist.city, '') IS NOT NULL
    AND lower(p.city) LIKE '%' || lower(v_artist.city) || '%'
  ON CONFLICT DO NOTHING;

  -- 2) Genres préférés de l'utilisateur qui correspondent au genre.
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT p.id, 'preference', v_artist.id, v_artist.name, v_artist.city, v_artist.country,
         'Nouvel artiste ' || coalesce(v_artist.genre, '') || ' à découvrir : ' || v_artist.name
  FROM public.profiles p
  WHERE p.id IS DISTINCT FROM auth.uid()
    AND NULLIF(v_artist.genre, '') IS NOT NULL
    AND p.favorite_genres IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p.favorite_genres) g
      WHERE NULLIF(g, '') IS NOT NULL
        AND lower(g) LIKE '%' || lower(v_artist.genre) || '%'
    )
  ON CONFLICT DO NOTHING;

  -- 3) Les abonnés des artistes de la même ville.
  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, city, country, message)
  SELECT DISTINCT f.user_id, 'followed_artist', v_artist.id, v_artist.name, v_artist.city, v_artist.country,
         'Un artiste de ' || coalesce(v_artist.city, 'la région') || ' vient d' || '''arriver : ' || v_artist.name
  FROM public.follows f
  JOIN public.map_artists ma ON ma.id = f.artist_id
  WHERE NULLIF(v_artist.city, '') IS NOT NULL
    AND lower(coalesce(ma.city, '')) = lower(v_artist.city)
    AND f.user_id IS DISTINCT FROM auth.uid()
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_discovery(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_discovery(text, text, text, text, text) TO authenticated;

/**
 * Alerte de l'artiste revendiqué : message borné à 280 caractères, et au
 * plus une alerte par auteur, par type et par jour (clé `ref`, index
 * unique de 00064) — un compte ne peut plus inonder un artiste.
 */
CREATE OR REPLACE FUNCTION public.notify_artist_action(
  p_artist_id text,
  p_type      text,
  p_message   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target      uuid;
  v_artist_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_type NOT IN ('follow', 'like', 'booking', 'achievement') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  SELECT claimed_by, name INTO v_target, v_artist_name
  FROM public.map_artists WHERE id = p_artist_id;

  -- Pas d'artiste revendiqué (profil non réclamé) ou action de l'artiste
  -- lui-même : on n'insère rien.
  IF v_target IS NULL OR v_target = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, message, ref)
  VALUES (
    v_target, p_type, p_artist_id, v_artist_name,
    NULLIF(left(btrim(coalesce(p_message, '')), 280), ''),
    'from:' || auth.uid()::text || ':' || current_date::text
  )
  ON CONFLICT (user_id, type, ref) WHERE ref IS NOT NULL DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_artist_action(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_artist_action(text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 4. waitlist
-- ------------------------------------------------------------
-- Envoyée par les formulaires depuis longtemps, jamais créée par une
-- migration (repli client sur l'upsert sans pays).
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS country text;

/** Accès au compteur depuis une politique RLS (5 demandes / jour, 300 au total). */
CREATE OR REPLACE FUNCTION public.consume_waitlist_slot()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.consume_rate_limit('waitlist', 5, 300)
$$;
REVOKE ALL ON FUNCTION public.consume_waitlist_slot() FROM public;
GRANT EXECUTE ON FUNCTION public.consume_waitlist_slot() TO anon, authenticated;

-- Plus aucune mise à jour publique : une demande existante ne se réécrit
-- que par submit_waitlist (règles ci-dessous) ou par l'admin.
DROP POLICY IF EXISTS "waitlist_update_public" ON public.waitlist;
DROP POLICY IF EXISTS "waitlist_update_admin" ON public.waitlist;
CREATE POLICY "waitlist_update_admin"
  ON public.waitlist FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Insertion directe (versions de l'app déjà installées) : jamais au nom
-- d'un autre compte, jamais déjà convertie, et comptée dans le quota.
DROP POLICY IF EXISTS "waitlist_insert_public" ON public.waitlist;
CREATE POLICY "waitlist_insert_public"
  ON public.waitlist FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND converted_at IS NULL
    AND map_artist_id IS NULL
    AND public.consume_waitlist_slot()
  );

/**
 * Demande de référencement (web + mobile). user_id vient de la session,
 * jamais du formulaire. Une demande existante (même email) n'est
 * réécrite que par son auteur connecté — compte lié, ou email de la
 * session identique — et tant qu'elle n'est pas convertie. Un visiteur
 * anonyme qui renvoie un email déjà connu reçoit `duplicate` : il ne
 * peut pas écraser la demande de quelqu'un d'autre.
 */
CREATE OR REPLACE FUNCTION public.submit_waitlist(p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_entry ->> 'email', '')));
  v_session_email text;
  v_existing record;
  v_profile text := coalesce(NULLIF(p_entry ->> 'profile', ''), 'artiste');
BEGIN
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR length(v_email) > 254 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;
  IF length(coalesce(p_entry ->> 'artist_name', '')) > 200
     OR length(coalesce(p_entry ->> 'bio', '')) > 5000
     OR length(coalesce(p_entry ->> 'city', '')) > 200
     OR length(coalesce(p_entry ->> 'district', '')) > 200
     OR length(coalesce(p_entry ->> 'country', '')) > 120
     OR length(coalesce(p_entry ->> 'genre', '')) > 120
     OR NOT public.is_safe_link(NULLIF(p_entry ->> 'link', ''))
     OR NOT public.is_safe_link(NULLIF(p_entry ->> 'photo', ''))
     OR NOT public.is_safe_link(NULLIF(p_entry ->> 'spotify', ''))
     OR NOT public.is_safe_link(NULLIF(p_entry ->> 'youtube', ''))
     OR NOT public.is_safe_link(NULLIF(p_entry ->> 'instagram', ''))
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;
  IF NOT public.consume_rate_limit('waitlist', 5, 300) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT id, user_id, converted_at INTO v_existing
    FROM public.waitlist
   WHERE lower(email) = v_email
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.waitlist (
      email, profile, artist_name, city, country, district, genre, link,
      bio, photo, spotify, youtube, instagram, user_id, created_at
    ) VALUES (
      v_email, v_profile,
      NULLIF(btrim(p_entry ->> 'artist_name'), ''),
      NULLIF(btrim(p_entry ->> 'city'), ''),
      NULLIF(btrim(p_entry ->> 'country'), ''),
      NULLIF(btrim(p_entry ->> 'district'), ''),
      NULLIF(btrim(p_entry ->> 'genre'), ''),
      NULLIF(btrim(p_entry ->> 'link'), ''),
      NULLIF(btrim(p_entry ->> 'bio'), ''),
      NULLIF(btrim(p_entry ->> 'photo'), ''),
      NULLIF(btrim(p_entry ->> 'spotify'), ''),
      NULLIF(btrim(p_entry ->> 'youtube'), ''),
      NULLIF(btrim(p_entry ->> 'instagram'), ''),
      v_uid,
      now()
    );
    RETURN jsonb_build_object('ok', true, 'duplicate', false);
  END IF;

  BEGIN
    v_session_email := lower(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email');
  EXCEPTION WHEN others THEN
    v_session_email := NULL;
  END;

  IF v_existing.converted_at IS NOT NULL
     OR v_uid IS NULL
     OR NOT (v_existing.user_id = v_uid OR v_session_email = v_email)
  THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE public.waitlist SET
    profile     = v_profile,
    artist_name = coalesce(NULLIF(btrim(p_entry ->> 'artist_name'), ''), artist_name),
    city        = coalesce(NULLIF(btrim(p_entry ->> 'city'), ''), city),
    country     = coalesce(NULLIF(btrim(p_entry ->> 'country'), ''), country),
    district    = coalesce(NULLIF(btrim(p_entry ->> 'district'), ''), district),
    genre       = coalesce(NULLIF(btrim(p_entry ->> 'genre'), ''), genre),
    link        = coalesce(NULLIF(btrim(p_entry ->> 'link'), ''), link),
    bio         = coalesce(NULLIF(btrim(p_entry ->> 'bio'), ''), bio),
    photo       = coalesce(NULLIF(btrim(p_entry ->> 'photo'), ''), photo),
    spotify     = coalesce(NULLIF(btrim(p_entry ->> 'spotify'), ''), spotify),
    youtube     = coalesce(NULLIF(btrim(p_entry ->> 'youtube'), ''), youtube),
    instagram   = coalesce(NULLIF(btrim(p_entry ->> 'instagram'), ''), instagram),
    user_id     = v_uid
  WHERE id = v_existing.id;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'updated', true);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_waitlist(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_waitlist(jsonb) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. Photos (bucket public artist-images)
-- ------------------------------------------------------------
/** 20 envois par visiteur et par jour, 500 au total. */
CREATE OR REPLACE FUNCTION public.consume_artist_image_upload()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.consume_rate_limit('artist_image_upload', 20, 500)
$$;
REVOKE ALL ON FUNCTION public.consume_artist_image_upload() FROM public;
GRANT EXECUTE ON FUNCTION public.consume_artist_image_upload() TO anon, authenticated;

DROP POLICY IF EXISTS "artist_images_insert_public" ON storage.objects;
CREATE POLICY "artist_images_insert_public"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artist-images' AND public.consume_artist_image_upload());
