-- Migration 009: Hardening, rollout flags, and query tuning

-- Better index alignment for current + new query patterns
CREATE INDEX IF NOT EXISTS idx_lists_user_updated
  ON public.lists(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_play_sessions_user_game
  ON public.play_sessions(user_id, game_id);

CREATE INDEX IF NOT EXISTS idx_activity_actor_type_created
  ON public.activity_events(actor_id, type, created_at DESC);

-- Optional quality-of-search extension/index for title lookup
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_games_title_trgm
  ON public.games USING gin (title gin_trgm_ops);

-- Rollout flags table for staged feature delivery
CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  rollout_pct integer NOT NULL DEFAULT 0 CHECK (rollout_pct >= 0 AND rollout_pct <= 100),
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER app_feature_flags_updated_at
  BEFORE UPDATE ON public.app_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_select_authenticated"
  ON public.app_feature_flags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "feature_flags_service_write"
  ON public.app_feature_flags FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial rollout defaults (safe disabled)
INSERT INTO public.app_feature_flags (key, enabled, rollout_pct, metadata)
VALUES
  ('taste_graph', false, 0, '{"owner":"social-discovery","phase":"phase1"}'),
  ('discovery_personalized', false, 0, '{"owner":"social-discovery","phase":"phase2"}'),
  ('social_circles', false, 0, '{"owner":"social-discovery","phase":"phase3"}'),
  ('feed_ranker', false, 0, '{"owner":"social-discovery","phase":"phase4"}')
ON CONFLICT (key) DO NOTHING;
