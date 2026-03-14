-- Migration 007: Taste graph and discovery instrumentation foundation

-- ============================================================
-- TASTE PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.taste_profiles (
  user_id              uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  genre_affinity       jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform_affinity    jsonb NOT NULL DEFAULT '{}'::jsonb,
  mood_affinity        jsonb NOT NULL DEFAULT '{}'::jsonb,
  novelty_preference   numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (novelty_preference >= 0 AND novelty_preference <= 1),
  challenge_preference numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (challenge_preference >= 0 AND challenge_preference <= 1),
  social_weight        numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (social_weight >= 0 AND social_weight <= 1),
  profile_version      integer NOT NULL DEFAULT 1,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER taste_profiles_updated_at
  BEFORE UPDATE ON public.taste_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taste_profiles_select_self_or_following"
  ON public.taste_profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "taste_profiles_insert_own"
  ON public.taste_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "taste_profiles_update_own"
  ON public.taste_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- TASTE SIGNALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.taste_signals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_type      text NOT NULL CHECK (signal_type IN ('review', 'status', 'session', 'list', 'feedback')),
  signal_weight    numeric(5,3) NOT NULL,
  source_entity_id uuid,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taste_signals_user_created
  ON public.taste_signals(user_id, created_at DESC);

ALTER TABLE public.taste_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taste_signals_select_own"
  ON public.taste_signals FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "taste_signals_insert_own"
  ON public.taste_signals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "taste_signals_insert_service"
  ON public.taste_signals FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================================
-- COMPATIBILITY SCORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compatibility_scores (
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  peer_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score         numeric(5,3) NOT NULL CHECK (score >= 0 AND score <= 1),
  reasons       jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_user_id),
  CHECK (user_id <> peer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_compatibility_user_score
  ON public.compatibility_scores(user_id, score DESC);

ALTER TABLE public.compatibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compatibility_select_own"
  ON public.compatibility_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "compatibility_upsert_own"
  ON public.compatibility_scores FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "compatibility_insert_service"
  ON public.compatibility_scores FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "compatibility_update_service"
  ON public.compatibility_scores FOR UPDATE TO service_role
  USING (true);

-- ============================================================
-- DISCOVERY TELEMETRY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.discovery_impressions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_game_id text NOT NULL,
  surface          text NOT NULL CHECK (surface IN ('discover_personalized', 'discover_contrarian', 'feed_context')),
  reason           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_impressions_user_created
  ON public.discovery_impressions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.discovery_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_game_id text NOT NULL,
  feedback_type    text NOT NULL CHECK (feedback_type IN ('open', 'skip', 'save', 'played')),
  source           text NOT NULL CHECK (source IN ('discover', 'feed', 'circle')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_feedback_user_created
  ON public.discovery_feedback(user_id, created_at DESC);

ALTER TABLE public.discovery_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discovery_impressions_select_own"
  ON public.discovery_impressions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "discovery_impressions_insert_own"
  ON public.discovery_impressions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "discovery_impressions_insert_service"
  ON public.discovery_impressions FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "discovery_feedback_select_own"
  ON public.discovery_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "discovery_feedback_insert_own"
  ON public.discovery_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "discovery_feedback_insert_service"
  ON public.discovery_feedback FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================================
-- RPC: refresh taste profile from existing user activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_taste_profile(p_user_id uuid)
RETURNS public.taste_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_genre_affinity jsonb := '{}'::jsonb;
  v_platform_affinity jsonb := '{}'::jsonb;
  v_review_count integer := 0;
  v_playing_count integer := 0;
  v_backlog_count integer := 0;
  v_social_count integer := 0;
  v_novelty numeric(4,3) := 0.5;
  v_challenge numeric(4,3) := 0.5;
  v_social numeric(4,3) := 0.5;
  v_profile public.taste_profiles;
BEGIN
  SELECT COUNT(*) INTO v_review_count
  FROM public.reviews r
  WHERE r.user_id = p_user_id;

  SELECT COUNT(*) FILTER (WHERE status = 'playing'),
         COUNT(*) FILTER (WHERE status = 'backlog')
  INTO v_playing_count, v_backlog_count
  FROM public.user_game_status ugs
  WHERE ugs.user_id = p_user_id;

  SELECT COUNT(*) INTO v_social_count
  FROM public.follows f
  WHERE f.follower_id = p_user_id;

  WITH review_genres AS (
    SELECT ge.genre, SUM(ge.weight) AS weight
    FROM (
      SELECT unnest(COALESCE(g.genres, ARRAY[]::text[])) AS genre, (r.rating / 5.0) AS weight
      FROM public.reviews r
      JOIN public.games g ON g.id = r.game_id
      WHERE r.user_id = p_user_id
      UNION ALL
      SELECT unnest(COALESCE(g.genres, ARRAY[]::text[])) AS genre, 0.6::numeric AS weight
      FROM public.user_game_status s
      JOIN public.games g ON g.id = s.game_id
      WHERE s.user_id = p_user_id
        AND s.status IN ('played', 'playing')
    ) ge
    GROUP BY ge.genre
  )
  SELECT COALESCE(jsonb_object_agg(genre, ROUND(weight::numeric, 3)), '{}'::jsonb)
  INTO v_genre_affinity
  FROM review_genres;

  WITH platform_weights AS (
    SELECT pe.platform, SUM(pe.weight) AS weight
    FROM (
      SELECT unnest(COALESCE(g.platforms, ARRAY[]::text[])) AS platform, (r.rating / 5.0) AS weight
      FROM public.reviews r
      JOIN public.games g ON g.id = r.game_id
      WHERE r.user_id = p_user_id
      UNION ALL
      SELECT unnest(COALESCE(g.platforms, ARRAY[]::text[])) AS platform, 0.6::numeric AS weight
      FROM public.user_game_status s
      JOIN public.games g ON g.id = s.game_id
      WHERE s.user_id = p_user_id
        AND s.status IN ('played', 'playing')
    ) pe
    GROUP BY pe.platform
  )
  SELECT COALESCE(jsonb_object_agg(platform, ROUND(weight::numeric, 3)), '{}'::jsonb)
  INTO v_platform_affinity
  FROM platform_weights;

  v_novelty := LEAST(1, GREATEST(0, COALESCE(jsonb_object_length(v_genre_affinity), 0) / 12.0));
  v_challenge := LEAST(1, GREATEST(0, (v_playing_count + v_backlog_count)::numeric / 20.0));
  v_social := LEAST(1, GREATEST(0, v_social_count::numeric / 15.0));

  INSERT INTO public.taste_profiles (
    user_id,
    genre_affinity,
    platform_affinity,
    mood_affinity,
    novelty_preference,
    challenge_preference,
    social_weight,
    profile_version,
    updated_at
  ) VALUES (
    p_user_id,
    v_genre_affinity,
    v_platform_affinity,
    '{}'::jsonb,
    ROUND(v_novelty, 3),
    ROUND(v_challenge, 3),
    ROUND(v_social, 3),
    1,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET genre_affinity = EXCLUDED.genre_affinity,
      platform_affinity = EXCLUDED.platform_affinity,
      mood_affinity = EXCLUDED.mood_affinity,
      novelty_preference = EXCLUDED.novelty_preference,
      challenge_preference = EXCLUDED.challenge_preference,
      social_weight = EXCLUDED.social_weight,
      profile_version = EXCLUDED.profile_version,
      updated_at = now()
  RETURNING * INTO v_profile;

  INSERT INTO public.taste_signals (user_id, signal_type, signal_weight, payload)
  VALUES (
    p_user_id,
    'status',
    ROUND((v_playing_count + v_backlog_count + v_review_count)::numeric / 5.0, 3),
    jsonb_build_object(
      'review_count', v_review_count,
      'playing_count', v_playing_count,
      'backlog_count', v_backlog_count
    )
  );

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_taste_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_taste_profile(uuid) TO authenticated, service_role;

-- ============================================================
-- RPC: refresh compatibility rows for a user
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_compatibility_for_user(
  p_user_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  PERFORM public.refresh_taste_profile(p_user_id);

  WITH my_profile AS (
    SELECT *
    FROM public.taste_profiles
    WHERE user_id = p_user_id
  ),
  peers AS (
    SELECT tp.user_id AS peer_user_id,
           tp.genre_affinity,
           tp.platform_affinity,
           tp.novelty_preference,
           tp.challenge_preference
    FROM public.taste_profiles tp
    WHERE tp.user_id <> p_user_id
    ORDER BY tp.updated_at DESC
    LIMIT GREATEST(1, p_limit)
  ),
  scored AS (
    SELECT
      p_user_id AS user_id,
      peers.peer_user_id,
      LEAST(
        1,
        GREATEST(
          0,
          (
            0.55 * (
              SELECT COALESCE(SUM(LEAST((m.value)::numeric, (p.value)::numeric)), 0)
              FROM jsonb_each_text((SELECT genre_affinity FROM my_profile)) m
              JOIN jsonb_each_text(peers.genre_affinity) p ON p.key = m.key
            )
            / NULLIF(
              (
                SELECT COALESCE(SUM((m2.value)::numeric), 0)
                FROM jsonb_each_text((SELECT genre_affinity FROM my_profile)) m2
              ), 0
            )
            + 0.25 * (
              SELECT COALESCE(SUM(LEAST((m.value)::numeric, (p.value)::numeric)), 0)
              FROM jsonb_each_text((SELECT platform_affinity FROM my_profile)) m
              JOIN jsonb_each_text(peers.platform_affinity) p ON p.key = m.key
            )
            / NULLIF(
              (
                SELECT COALESCE(SUM((m2.value)::numeric), 0)
                FROM jsonb_each_text((SELECT platform_affinity FROM my_profile)) m2
              ), 0
            )
            + 0.2 * (
              1 - LEAST(
                1,
                ABS((SELECT novelty_preference FROM my_profile) - peers.novelty_preference)
              )
            )
          )
        )
      ) AS score,
      jsonb_build_array(
        'Genre overlap',
        'Platform overlap',
        'Playstyle similarity'
      ) AS reasons
    FROM peers
  )
  INSERT INTO public.compatibility_scores (user_id, peer_user_id, score, reasons, calculated_at)
  SELECT
    user_id,
    peer_user_id,
    ROUND(COALESCE(score, 0)::numeric, 3),
    reasons,
    now()
  FROM scored
  ON CONFLICT (user_id, peer_user_id) DO UPDATE
  SET score = EXCLUDED.score,
      reasons = EXCLUDED.reasons,
      calculated_at = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_compatibility_for_user(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_compatibility_for_user(uuid, integer) TO authenticated, service_role;
