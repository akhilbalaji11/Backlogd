-- Migration 008: Social circles and backlog challenges

-- ============================================================
-- SOCIAL CIRCLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_circles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description text,
  visibility  text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_circles_owner
  ON public.social_circles(owner_id, created_at DESC);

ALTER TABLE public.social_circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_circles_insert_own"
  ON public.social_circles FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "social_circles_update_own"
  ON public.social_circles FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "social_circles_delete_own"
  ON public.social_circles FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================
-- CIRCLE MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.circle_members (
  circle_id uuid NOT NULL REFERENCES public.social_circles(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_user
  ON public.circle_members(user_id, joined_at DESC);

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circle_members_select_member_scope"
  ON public.circle_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "circle_members_insert_own"
  ON public.circle_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "circle_members_delete_self_or_owner"
  ON public.circle_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR circle_id IN (
      SELECT id FROM public.social_circles WHERE owner_id = auth.uid()
    )
  );

-- Depends on public.circle_members existing
CREATE POLICY "social_circles_select_owned_or_member"
  ON public.social_circles FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.circle_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id   uuid NOT NULL REFERENCES public.social_circles(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  goal_type   text NOT NULL CHECK (goal_type IN ('finish_count', 'session_minutes')),
  goal_target integer NOT NULL CHECK (goal_target > 0),
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_circle_challenges_circle_dates
  ON public.circle_challenges(circle_id, start_date DESC, end_date DESC);

ALTER TABLE public.circle_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circle_challenges_select_member_scope"
  ON public.circle_challenges FOR SELECT TO authenticated
  USING (
    circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "circle_challenges_insert_circle_member"
  ON public.circle_challenges FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND circle_id IN (
      SELECT circle_id FROM public.circle_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "circle_challenges_update_circle_owner"
  ON public.circle_challenges FOR UPDATE TO authenticated
  USING (
    circle_id IN (SELECT id FROM public.social_circles WHERE owner_id = auth.uid())
  );

-- ============================================================
-- CHALLENGE PROGRESS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_progress (
  challenge_id   uuid NOT NULL REFERENCES public.circle_challenges(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_value integer NOT NULL DEFAULT 0 CHECK (progress_value >= 0),
  last_event_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_user
  ON public.challenge_progress(user_id, last_event_at DESC);

ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_progress_select_member_scope"
  ON public.challenge_progress FOR SELECT TO authenticated
  USING (
    challenge_id IN (
      SELECT cc.id
      FROM public.circle_challenges cc
      JOIN public.circle_members cm ON cm.circle_id = cc.circle_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "challenge_progress_insert_own"
  ON public.challenge_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND challenge_id IN (
      SELECT cc.id
      FROM public.circle_challenges cc
      JOIN public.circle_members cm ON cm.circle_id = cc.circle_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "challenge_progress_update_own"
  ON public.challenge_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Activity enum extension for challenge events
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'activity_type'
      AND e.enumlabel = 'challenge'
  ) THEN
    ALTER TYPE public.activity_type ADD VALUE 'challenge';
  END IF;
END $$;
