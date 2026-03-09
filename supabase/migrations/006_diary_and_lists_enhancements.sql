-- Migration 006: Strengthen diary dates and support richer list metadata

ALTER TABLE public.play_sessions
DROP CONSTRAINT IF EXISTS play_sessions_played_on_not_future;

ALTER TABLE public.play_sessions
ADD CONSTRAINT play_sessions_played_on_not_future
CHECK (played_on <= CURRENT_DATE);

ALTER TABLE public.lists
ADD COLUMN IF NOT EXISTS subtitle text;
