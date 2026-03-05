-- Migration 002: Games cache table
-- Game metadata is fetched from IGDB via edge functions and cached here

CREATE TABLE IF NOT EXISTS public.games (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         text NOT NULL DEFAULT 'igdb',
  provider_game_id text NOT NULL,
  title            text NOT NULL,
  cover_url        text,
  release_date     date,
  genres           text[] DEFAULT '{}',
  platforms        text[] DEFAULT '{}',
  themes           text[] DEFAULT '{}',
  description      text,
  rating           numeric(4,1),   -- IGDB rating 0-100
  similar_game_ids text[] DEFAULT '{}',
  raw_json         jsonb,
  updated_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT games_provider_unique UNIQUE (provider, provider_game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_provider_id ON public.games(provider, provider_game_id);
CREATE INDEX IF NOT EXISTS idx_games_title ON public.games USING GIN (to_tsvector('english', title));

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read game cache
CREATE POLICY "games_select_authenticated"
  ON public.games FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role (edge functions) can upsert game data
-- Mobile app reads only; writing happens via edge functions with service key
CREATE POLICY "games_insert_service"
  ON public.games FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "games_update_service"
  ON public.games FOR UPDATE
  TO service_role
  USING (true);

-- ============================================================
-- USER_GAME_STATUS
-- ============================================================
CREATE TYPE public.game_status AS ENUM ('played', 'playing', 'backlog', 'wishlist');

CREATE TABLE IF NOT EXISTS public.user_game_status (
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  status       public.game_status NOT NULL,
  added_at     timestamptz DEFAULT now() NOT NULL,
  last_updated timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_ugs_user ON public.user_game_status(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ugs_game ON public.user_game_status(game_id);

ALTER TABLE public.user_game_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugs_select_authenticated"
  ON public.user_game_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ugs_insert_own"
  ON public.user_game_status FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ugs_update_own"
  ON public.user_game_status FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ugs_delete_own"
  ON public.user_game_status FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id     uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  rating      numeric(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  review_text text,
  spoiler     boolean DEFAULT false NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT one_review_per_game UNIQUE (user_id, game_id)
);

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_game ON public.reviews(game_id, rating DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_authenticated"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "reviews_delete_own"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- REVIEW_LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_likes (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_id  uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_review ON public.review_likes(review_id);

ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_likes_select_authenticated"
  ON public.review_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "review_likes_insert_own"
  ON public.review_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "review_likes_delete_own"
  ON public.review_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- REVIEW_COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_text text NOT NULL CHECK (length(comment_text) > 0 AND length(comment_text) <= 1000),
  created_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review ON public.review_comments(review_id, created_at);

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_comments_select_authenticated"
  ON public.review_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "review_comments_insert_own"
  ON public.review_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "review_comments_update_own"
  ON public.review_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "review_comments_delete_own"
  ON public.review_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- PLAY_SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.play_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id    uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  played_on  date NOT NULL DEFAULT CURRENT_DATE,
  minutes    integer CHECK (minutes > 0),
  platform   text,
  notes      text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON public.play_sessions(user_id, played_on DESC);

ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;

-- Private: only owner can see their diary
CREATE POLICY "play_sessions_select_own"
  ON public.play_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "play_sessions_insert_own"
  ON public.play_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "play_sessions_update_own"
  ON public.play_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "play_sessions_delete_own"
  ON public.play_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
