-- Migration 003: Lists and Activity Feed

-- ============================================================
-- LISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) >= 1 AND length(title) <= 100),
  description text,
  is_public   boolean DEFAULT true NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lists_user ON public.lists(user_id, created_at DESC);

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lists_select_public_or_own"
  ON public.lists FOR SELECT TO authenticated
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "lists_insert_own"
  ON public.lists FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lists_update_own"
  ON public.lists FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "lists_delete_own"
  ON public.lists FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- LIST_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.list_items (
  list_id    uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  game_id    uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  position   integer NOT NULL DEFAULT 0,
  note       text,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (list_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_list_items_list ON public.list_items(list_id, position);

ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- Read via list visibility
CREATE POLICY "list_items_select_via_list"
  ON public.list_items FOR SELECT TO authenticated
  USING (
    list_id IN (
      SELECT id FROM public.lists
      WHERE is_public = true OR user_id = auth.uid()
    )
  );

-- Write: only if you own the list
CREATE POLICY "list_items_insert_own"
  ON public.list_items FOR INSERT TO authenticated
  WITH CHECK (
    list_id IN (SELECT id FROM public.lists WHERE user_id = auth.uid())
  );

CREATE POLICY "list_items_update_own"
  ON public.list_items FOR UPDATE TO authenticated
  USING (
    list_id IN (SELECT id FROM public.lists WHERE user_id = auth.uid())
  );

CREATE POLICY "list_items_delete_own"
  ON public.list_items FOR DELETE TO authenticated
  USING (
    list_id IN (SELECT id FROM public.lists WHERE user_id = auth.uid())
  );

-- ============================================================
-- ACTIVITY_EVENTS
-- ============================================================
CREATE TYPE public.activity_type AS ENUM (
  'review', 'rating', 'status_change', 'list_add', 'follow'
);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       public.activity_type NOT NULL,
  entity_id  uuid,
  metadata   jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_actor ON public.activity_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_events(created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Users see activity from people they follow + their own
CREATE POLICY "activity_select_feed"
  ON public.activity_events FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid()
    OR actor_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
    )
  );

-- Service role writes events (triggered via edge functions)
CREATE POLICY "activity_insert_service"
  ON public.activity_events FOR INSERT TO service_role
  WITH CHECK (true);

-- Also allow authenticated users to insert their own events
CREATE POLICY "activity_insert_own"
  ON public.activity_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- HELPER VIEW: game stats
-- ============================================================
CREATE OR REPLACE VIEW public.game_stats AS
SELECT
  g.id AS game_id,
  g.title,
  COUNT(DISTINCT r.id) AS review_count,
  ROUND(AVG(r.rating), 1) AS avg_rating,
  COUNT(DISTINCT ugs.user_id) FILTER (WHERE ugs.status = 'played') AS played_count,
  COUNT(DISTINCT ugs.user_id) FILTER (WHERE ugs.status = 'playing') AS playing_count,
  COUNT(DISTINCT ugs.user_id) FILTER (WHERE ugs.status = 'backlog') AS backlog_count,
  COUNT(DISTINCT ugs.user_id) FILTER (WHERE ugs.status = 'wishlist') AS wishlist_count
FROM public.games g
LEFT JOIN public.reviews r ON r.game_id = g.id
LEFT JOIN public.user_game_status ugs ON ugs.game_id = g.id
GROUP BY g.id, g.title;
