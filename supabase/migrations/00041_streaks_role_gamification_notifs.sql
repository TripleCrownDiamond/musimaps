-- ============================================================
-- 00041 — Streaks de connexion, gamification par rôle, notifs actions
-- - user_streaks : connexions quotidiennes consécutives (streak).
-- - checkin() : RPC de pointage quotidien (appelée à chaque connexion).
-- - notifications.type étendu : follow, like, booking, booking_status,
--   streak, achievement (en plus des types découverte existants).
-- - notify_artist_action : notifie l'artiste revendiqué (follow, like,
--   booking, achievement) — ciblée, jamais pour soi-même.
-- - notify_booking_status : l'artiste notifie le demandeur (confirmé/rejeté).
-- - map_artists.events : colonne jsonb pour les dates de concert
--   (animations des pins en concert sur le globe).
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_streaks — série de connexions quotidiennes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak    INTEGER NOT NULL DEFAULT 0,
  total_checkins INTEGER NOT NULL DEFAULT 0,
  last_checkin   DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_streaks_select_own" ON public.user_streaks;
CREATE POLICY "user_streaks_select_own"
  ON public.user_streaks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_streaks_update_own" ON public.user_streaks;
CREATE POLICY "user_streaks_update_own"
  ON public.user_streaks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pointage quotidien : streak +1 si la veille, reset à 1 sinon, jamais
-- deux fois le même jour. Appelée à chaque connexion (web + mobile).
CREATE OR REPLACE FUNCTION public.checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_today     date := current_date;
  v_yesterday date := current_date - 1;
  v_row       public.user_streaks%ROWTYPE;
  v_streak    int;
  v_best      int;
  v_total     int;
  v_checked   boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_row FROM public.user_streaks WHERE user_id = v_uid FOR UPDATE;

  IF v_row.user_id IS NULL THEN
    INSERT INTO public.user_streaks (user_id, current_streak, best_streak, total_checkins, last_checkin)
    VALUES (v_uid, 1, 1, 1, v_today)
    ON CONFLICT (user_id) DO NOTHING;
    v_streak := 1; v_best := 1; v_total := 1;
  ELSIF v_row.last_checkin = v_today THEN
    v_checked := true;
    v_streak := v_row.current_streak;
    v_best   := v_row.best_streak;
    v_total  := v_row.total_checkins;
  ELSE
    v_total := v_row.total_checkins + 1;
    IF v_row.last_checkin = v_yesterday THEN
      v_streak := v_row.current_streak + 1;
    ELSE
      v_streak := 1;
    END IF;
    v_best := GREATEST(v_row.best_streak, v_streak);
    UPDATE public.user_streaks
       SET current_streak = v_streak, best_streak = v_best,
           total_checkins = v_total, last_checkin = v_today, updated_at = now()
     WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'current', v_streak,
    'best', v_best,
    'total', v_total,
    'checked_today', v_checked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkin() FROM public;
GRANT EXECUTE ON FUNCTION public.checkin() TO authenticated;

-- ------------------------------------------------------------
-- 2. notifications.type étendu (actions + streaks + achievements)
-- ------------------------------------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'discovery', 'followed_artist', 'preference', 'nearby',
    'follow', 'like', 'booking', 'booking_status', 'streak', 'achievement'
  ));

-- ------------------------------------------------------------
-- 3. notify_artist_action — follow / like / booking / achievement
-- pour l'artiste revendiqué du profil. Sélectif : jamais pour soi.
-- ------------------------------------------------------------
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

  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, message)
  VALUES (v_target, p_type, p_artist_id, v_artist_name, NULLIF(p_message, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.notify_artist_action(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_artist_action(text, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 4. notify_booking_status — l'artiste notifie le demandeur
-- (confirmé / rejeté). Réservé à l'artiste revendiqué ou à l'admin.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_booking_status(
  p_booking_id uuid,
  p_status     text,
  p_message    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booker      uuid;
  v_artist_name text;
  v_artist_id   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_status NOT IN ('confirmed', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT b.user_id, b.artist_name, b.artist_id
    INTO v_booker, v_artist_name, v_artist_id
  FROM public.bookings b WHERE b.id = p_booking_id;

  IF v_booker IS NULL OR v_booker = auth.uid() THEN
    RETURN;
  END IF;

  -- Seul l'artiste qui a revendiqué ce profil (ou un admin) peut notifier.
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.map_artists
    WHERE id = v_artist_id AND claimed_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.notifications (user_id, type, artist_id, artist_name, message)
  VALUES (v_booker, 'booking_status', v_artist_id, v_artist_name, NULLIF(p_message, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.notify_booking_status(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.notify_booking_status(uuid, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 5. map_artists.events — dates de concert (animations globe)
-- ------------------------------------------------------------
ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '[]'::jsonb;
