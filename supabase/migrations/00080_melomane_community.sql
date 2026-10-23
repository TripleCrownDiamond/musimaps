-- ============================================================
-- 00080 — Communauté de mélomanes
--
-- Jusqu'ici un mélomane ne voyait que les artistes : son profil n'était
-- lisible que par lui (profiles_read_own). Cette migration ajoute :
--
--   1. le profil public, au choix (profiles.is_public + handle) ;
--   2. suivre un mélomane (user_follows) ;
--   3. les sélections d'artistes partageables (collections, collection_items,
--      collection_likes) ;
--   4. la modération étendue aux profils et aux sélections (content_reports
--      cible un artiste, un profil OU une sélection ; user_blocks) ;
--   5. les notifications « vous suit », « nouvelle sélection », « aime votre
--      sélection ».
--
-- profiles reste fermé en lecture : les données publiques passent par des
-- RPC SECURITY DEFINER qui ne renvoient que des colonnes sûres, jamais la
-- ville précise du quartier, l'e-mail ou le palier de compte.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profil public
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS bio text;

DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
  -- Même règle que normalizeHandle (packages/shared/src/lib/community.ts).
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_format
    CHECK (handle IS NULL OR handle ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$');
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_length;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 500);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON public.profiles (handle) WHERE handle IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Blocages entre utilisateurs (avant tout le reste : les lectures en dépendent)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_blocks_select_own" ON public.user_blocks;
CREATE POLICY "user_blocks_select_own" ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

-- Vrai si l'un des deux a bloqué l'autre : ni profil, ni sélection, ni suivi.
CREATE OR REPLACE FUNCTION public.users_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = p_a AND blocked_id = p_b) OR (blocker_id = p_b AND blocked_id = p_a)
  );
$$;
REVOKE ALL ON FUNCTION public.users_blocked(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.users_blocked(uuid, uuid) TO anon, authenticated;

-- Vrai si le compte a un profil public (profiles reste fermé en lecture :
-- une politique qui le lirait directement ne verrait que son propre profil).
CREATE OR REPLACE FUNCTION public.is_public_profile(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND is_public);
$$;
REVOKE ALL ON FUNCTION public.is_public_profile(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_public_profile(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. Suivre un mélomane
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS user_follows_followee_idx ON public.user_follows (followee_id);
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_follows_select_own" ON public.user_follows;
CREATE POLICY "user_follows_select_own" ON public.user_follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);
-- On ne suit qu'un profil public, et jamais quelqu'un avec qui un blocage existe.
DROP POLICY IF EXISTS "user_follows_insert_own" ON public.user_follows;
CREATE POLICY "user_follows_insert_own" ON public.user_follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND public.is_public_profile(followee_id)
    AND NOT public.users_blocked(follower_id, followee_id)
  );
DROP POLICY IF EXISTS "user_follows_delete_own" ON public.user_follows;
CREATE POLICY "user_follows_delete_own" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;

-- Un blocage coupe le suivi dans les deux sens.
CREATE OR REPLACE FUNCTION public.user_blocks_cut_follows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_follows
  WHERE (follower_id = NEW.blocker_id AND followee_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND followee_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_blocks_cut_follows ON public.user_blocks;
CREATE TRIGGER trg_user_blocks_cut_follows
  AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.user_blocks_cut_follows();

-- ------------------------------------------------------------
-- 4. Sélections d'artistes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  is_public   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collections_owner_idx ON public.collections (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.collection_items (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  artist_id     text NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, artist_id)
);

CREATE TABLE IF NOT EXISTS public.collection_likes (
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, collection_id)
);
CREATE INDEX IF NOT EXISTS collection_likes_collection_idx ON public.collection_likes (collection_id);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_likes ENABLE ROW LEVEL SECURITY;

-- Une sélection publique se partage par lien, même depuis un profil privé.
DROP POLICY IF EXISTS "collections_select_visible" ON public.collections;
CREATE POLICY "collections_select_visible" ON public.collections FOR SELECT
  USING (owner_id = auth.uid() OR (is_public AND NOT public.users_blocked(auth.uid(), owner_id)));
DROP POLICY IF EXISTS "collections_insert_own" ON public.collections;
CREATE POLICY "collections_insert_own" ON public.collections FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "collections_update_own" ON public.collections;
CREATE POLICY "collections_update_own" ON public.collections FOR UPDATE
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "collections_delete_own" ON public.collections;
CREATE POLICY "collections_delete_own" ON public.collections FOR DELETE USING (owner_id = auth.uid());
GRANT SELECT ON public.collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.collections TO authenticated;

DROP POLICY IF EXISTS "collection_items_select_visible" ON public.collection_items;
CREATE POLICY "collection_items_select_visible" ON public.collection_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id));
DROP POLICY IF EXISTS "collection_items_write_owner" ON public.collection_items;
CREATE POLICY "collection_items_write_owner" ON public.collection_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.owner_id = auth.uid()));
GRANT SELECT ON public.collection_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;

DROP POLICY IF EXISTS "collection_likes_select_own" ON public.collection_likes;
CREATE POLICY "collection_likes_select_own" ON public.collection_likes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "collection_likes_insert_own" ON public.collection_likes;
CREATE POLICY "collection_likes_insert_own" ON public.collection_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.is_public AND c.owner_id <> auth.uid())
  );
DROP POLICY IF EXISTS "collection_likes_delete_own" ON public.collection_likes;
CREATE POLICY "collection_likes_delete_own" ON public.collection_likes FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON public.collection_likes TO authenticated;

-- Plafond d'artistes par sélection (COLLECTION_MAX_ITEMS côté shared) et
-- date de mise à jour de la sélection.
CREATE OR REPLACE FUNCTION public.collection_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.collection_items WHERE collection_id = NEW.collection_id) >= 50 THEN
    RAISE EXCEPTION 'collection_full' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.collections SET updated_at = now() WHERE id = NEW.collection_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_collection_items_guard ON public.collection_items;
CREATE TRIGGER trg_collection_items_guard
  BEFORE INSERT ON public.collection_items
  FOR EACH ROW EXECUTE FUNCTION public.collection_items_guard();

-- ------------------------------------------------------------
-- 5. Notifications communautaires
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'discovery', 'followed_artist', 'preference', 'nearby', 'follow', 'like',
    'booking', 'booking_status', 'streak', 'achievement', 'collection'
  ));
END $$;

-- Nom affiché d'un compte dans une notification.
CREATE OR REPLACE FUNCTION public.community_name(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(NULLIF(btrim(display_name), ''), handle, 'Un mélomane')
  FROM public.profiles WHERE id = p_user;
$$;
REVOKE ALL ON FUNCTION public.community_name(uuid) FROM public;

-- « X vous suit » — lien vers son profil s'il est public.
CREATE OR REPLACE FUNCTION public.notify_user_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle text;
BEGIN
  SELECT handle INTO v_handle FROM public.profiles WHERE id = NEW.follower_id AND is_public;
  INSERT INTO public.notifications (user_id, type, ref, message)
  VALUES (
    NEW.followee_id, 'follow',
    CASE WHEN v_handle IS NOT NULL THEN 'profile:' || v_handle ELSE 'follower:' || NEW.follower_id END,
    coalesce(public.community_name(NEW.follower_id), 'Un mélomane') || ' vous suit désormais.'
  )
  ON CONFLICT (user_id, type, ref) WHERE ref IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_follows_notify ON public.user_follows;
CREATE TRIGGER trg_user_follows_notify
  AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_follow();

-- « X a publié une sélection » — dès qu'une sélection publique reçoit un
-- artiste (une sélection vide n'a rien à montrer). La clé `ref` unique par
-- abonné garantit une seule alerte par sélection, quel que soit le nombre
-- d'artistes ajoutés ensuite.
CREATE OR REPLACE FUNCTION public.notify_collection_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection public.collections%ROWTYPE;
BEGIN
  SELECT * INTO v_collection FROM public.collections WHERE id = NEW.collection_id;
  IF NOT v_collection.is_public THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, ref, message)
  SELECT f.follower_id, 'collection', 'collection:' || v_collection.id,
         coalesce(public.community_name(v_collection.owner_id), 'Un mélomane')
           || ' a publié la sélection « ' || v_collection.title || ' ».'
  FROM public.user_follows f
  WHERE f.followee_id = v_collection.owner_id
  ON CONFLICT (user_id, type, ref) WHERE ref IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_collection_items_notify ON public.collection_items;
CREATE TRIGGER trg_collection_items_notify
  AFTER INSERT ON public.collection_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_collection_published();

-- « X aime votre sélection » — une alerte par personne et par sélection.
CREATE OR REPLACE FUNCTION public.notify_collection_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection public.collections%ROWTYPE;
BEGIN
  SELECT * INTO v_collection FROM public.collections WHERE id = NEW.collection_id;
  INSERT INTO public.notifications (user_id, type, ref, message)
  VALUES (
    v_collection.owner_id, 'like', 'collection:' || v_collection.id || ':' || NEW.user_id,
    coalesce(public.community_name(NEW.user_id), 'Un mélomane')
      || ' aime votre sélection « ' || v_collection.title || ' ».'
  )
  ON CONFLICT (user_id, type, ref) WHERE ref IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_collection_likes_notify ON public.collection_likes;
CREATE TRIGGER trg_collection_likes_notify
  AFTER INSERT ON public.collection_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_collection_like();

-- ------------------------------------------------------------
-- 6. Signalements : artiste, profil OU sélection
-- ------------------------------------------------------------
ALTER TABLE public.content_reports ALTER COLUMN artist_id DROP NOT NULL;
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE;
DO $$
BEGIN
  ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_one_target;
  ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_one_target
    CHECK (num_nonnulls(artist_id, profile_id, collection_id) = 1);
END $$;

-- ------------------------------------------------------------
-- 7. Lectures publiques (RPC) — colonnes sûres uniquement
-- ------------------------------------------------------------

-- Activer / couper son profil public et choisir son identifiant.
CREATE OR REPLACE FUNCTION public.set_public_profile(p_public boolean, p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle text := lower(btrim(coalesce(p_handle, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_public AND v_handle !~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'handle_invalid');
  END IF;
  IF p_public AND EXISTS (SELECT 1 FROM public.profiles WHERE handle = v_handle AND id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'handle_taken');
  END IF;
  UPDATE public.profiles
    SET is_public = p_public,
        handle = CASE WHEN p_public THEN v_handle ELSE handle END
    WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.set_public_profile(boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_public_profile(boolean, text) TO authenticated;

-- Résumé public d'une sélection (cartes de liste).
CREATE OR REPLACE FUNCTION public.collection_summary(p_collection public.collections)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p_collection.id,
    'title', p_collection.title,
    'description', p_collection.description,
    'isPublic', p_collection.is_public,
    'updatedAt', p_collection.updated_at,
    'itemCount', (SELECT count(*) FROM public.collection_items i WHERE i.collection_id = p_collection.id),
    'likeCount', (SELECT count(*) FROM public.collection_likes l WHERE l.collection_id = p_collection.id),
    'covers', coalesce((
      SELECT jsonb_agg(a.image ORDER BY i.position, i.added_at)
      FROM (SELECT * FROM public.collection_items i2 WHERE i2.collection_id = p_collection.id
            ORDER BY i2.position, i2.added_at LIMIT 4) i
      JOIN public.map_artists a ON a.id = i.artist_id
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.collection_summary(public.collections) FROM public;

-- Carte d'identité publique d'un compte (auteur, abonné…).
CREATE OR REPLACE FUNCTION public.public_person(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'handle', CASE WHEN p.is_public THEN p.handle END,
    'displayName', coalesce(NULLIF(btrim(p.display_name), ''), p.handle),
    'avatarUrl', p.avatar_url,
    'city', CASE WHEN p.is_public THEN p.city END,
    'country', CASE WHEN p.is_public THEN p.country END,
    'role', p.role
  )
  FROM public.profiles p WHERE p.id = p_user;
$$;
REVOKE ALL ON FUNCTION public.public_person(uuid) FROM public;

-- Profil public complet, par identifiant (@handle).
CREATE OR REPLACE FUNCTION public.get_public_profile(p_handle text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_me uuid := auth.uid();
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE handle = lower(btrim(p_handle));
  IF NOT FOUND OR (NOT v_profile.is_public AND v_profile.id IS DISTINCT FROM v_me)
     OR public.users_blocked(v_me, v_profile.id) THEN
    RETURN NULL;
  END IF;
  RETURN public.public_person(v_profile.id) || jsonb_build_object(
    'bio', coalesce(v_profile.bio, ''),
    'favoriteGenres', coalesce(v_profile.favorite_genres, '[]'::jsonb),
    'isPublic', v_profile.is_public,
    'isMe', v_profile.id = v_me,
    'joinedAt', v_profile.created_at,
    'followerCount', (SELECT count(*) FROM public.user_follows WHERE followee_id = v_profile.id),
    'followingCount', (SELECT count(*) FROM public.user_follows WHERE follower_id = v_profile.id),
    'isFollowing', EXISTS (SELECT 1 FROM public.user_follows WHERE follower_id = v_me AND followee_id = v_profile.id),
    'followedArtists', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'image', a.image, 'city', a.city, 'genre', a.genre)
                       ORDER BY f.created_at DESC)
      FROM (SELECT * FROM public.follows WHERE user_id = v_profile.id ORDER BY created_at DESC LIMIT 24) f
      JOIN public.map_artists a ON a.id = f.artist_id
    ), '[]'::jsonb),
    'collections', coalesce((
      SELECT jsonb_agg(public.collection_summary(c) ORDER BY c.updated_at DESC)
      FROM public.collections c
      WHERE c.owner_id = v_profile.id AND (c.is_public OR c.owner_id = v_me)
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated;

-- Une sélection avec ses artistes, son auteur et ses « j'aime ».
CREATE OR REPLACE FUNCTION public.get_collection(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection public.collections%ROWTYPE;
  v_me uuid := auth.uid();
BEGIN
  SELECT * INTO v_collection FROM public.collections WHERE id = p_id;
  IF NOT FOUND OR (NOT v_collection.is_public AND v_collection.owner_id IS DISTINCT FROM v_me)
     OR public.users_blocked(v_me, v_collection.owner_id) THEN
    RETURN NULL;
  END IF;
  RETURN public.collection_summary(v_collection) || jsonb_build_object(
    'owner', public.public_person(v_collection.owner_id),
    'isMine', v_collection.owner_id = v_me,
    'likedByMe', EXISTS (SELECT 1 FROM public.collection_likes WHERE collection_id = p_id AND user_id = v_me),
    'artists', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'image', a.image, 'city', a.city,
               'country', a.country, 'genre', a.genre, 'slug', a.slug)
             ORDER BY i.position, i.added_at)
      FROM public.collection_items i
      JOIN public.map_artists a ON a.id = i.artist_id
      WHERE i.collection_id = p_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_collection(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_collection(uuid) TO anon, authenticated;

-- Recherche de profils publics (nom, @identifiant ou ville).
CREATE OR REPLACE FUNCTION public.search_public_profiles(p_query text, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(public.public_person(p.id) ORDER BY p.display_name), '[]'::jsonb)
  FROM (
    SELECT id, display_name FROM public.profiles
    WHERE is_public
      AND id IS DISTINCT FROM auth.uid()
      AND NOT public.users_blocked(auth.uid(), id)
      AND (
        coalesce(btrim(p_query), '') = ''
        OR display_name ILIKE '%' || btrim(p_query) || '%'
        OR handle ILIKE '%' || ltrim(btrim(p_query), '@') || '%'
        OR city ILIKE '%' || btrim(p_query) || '%'
      )
    ORDER BY display_name
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  ) p;
$$;
REVOKE ALL ON FUNCTION public.search_public_profiles(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, integer) TO anon, authenticated;

-- Dernières sélections publiques des mélomanes suivis.
CREATE OR REPLACE FUNCTION public.following_collections(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(
           public.collection_summary(c) || jsonb_build_object('owner', public.public_person(c.owner_id))
           ORDER BY c.updated_at DESC), '[]'::jsonb)
  FROM public.collections c
  WHERE c.id IN (
    SELECT c.id FROM public.collections c
    JOIN public.user_follows f ON f.followee_id = c.owner_id AND f.follower_id = auth.uid()
    WHERE c.is_public
      AND EXISTS (SELECT 1 FROM public.collection_items i WHERE i.collection_id = c.id)
    ORDER BY c.updated_at DESC
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  );
$$;
REVOKE ALL ON FUNCTION public.following_collections(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.following_collections(integer) TO authenticated;

-- Mélomanes que je suis (pour l'onglet « Abonnements »).
CREATE OR REPLACE FUNCTION public.my_followed_people()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(public.public_person(f.followee_id) ORDER BY f.created_at DESC), '[]'::jsonb)
  FROM public.user_follows f
  JOIN public.profiles p ON p.id = f.followee_id AND p.is_public
  WHERE f.follower_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_followed_people() FROM public;
GRANT EXECUTE ON FUNCTION public.my_followed_people() TO authenticated;
