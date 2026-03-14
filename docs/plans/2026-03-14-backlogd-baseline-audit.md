# Backlogd Baseline Audit

## Product Snapshot

Backlogd is a mobile social game log focused on status tracking, reviews, diary sessions, custom lists, discovery, and activity feed behavior.

## Stack

- Mobile: Expo + React Native + Expo Router + TypeScript
- Data access: Supabase JS from client + Edge Functions for IGDB-backed metadata
- Backend: Supabase Postgres + RLS + Auth + Storage + Deno Edge Functions
- Recommendation: deterministic in-app recommender with Jest coverage

## Current Capability Baseline

- Auth and profile setup with avatar upload
- Game search/browse/detail through edge functions (`games-search`, `games-browse`, `games-detail`)
- Status/review/rating flows and activity event writes
- Diary logging and list management surfaces
- Discover tab with trending shelf + deterministic recommendations + feed

## API Usage Baseline

- Edge functions used for metadata and optional AI tags from `apps/mobile/src/lib/api.ts`
- Direct client Supabase table operations for:
  - `profiles`, `follows`
  - `user_game_status`, `reviews`, `play_sessions`
  - `lists`, `list_items`, `activity_events`
- Existing discover ranking mostly in-app with direct table fetches and deterministic scoring

## Database + RLS Baseline

Schema source:
- `supabase/migrations/001_profiles_follows.sql`
- `supabase/migrations/002_games_statuses_reviews.sql`
- `supabase/migrations/003_lists_activity.sql`
- `supabase/migrations/004_manual_games_insert_policy.sql`
- `supabase/migrations/005_play_sessions_first_time.sql`
- `supabase/migrations/006_diary_and_lists_enhancements.sql`

Notable baseline details:
- User-owned tables enforce `auth.uid()` ownership patterns
- Feed read policy includes self + followed users
- Lists are visibility-scoped (`is_public` OR owner)
- Existing indexes support core current read patterns but not advanced discovery analytics

## Gaps Confirmed in Code

- AI tag endpoint exists but is not integrated deeply in current user journey
- Follow relationships exist but social UX depth is limited
- Discovery experience remains mostly first-order (genre/rating overlap), not network-aware
- No dedicated schema for compatibility scores, impressions, feedback, circles, or challenges

## Improvement Direction Chosen

- Scope: video games only
- Priority themes: social depth + discovery intelligence
- Delivery shape: phased implementation with safe incremental rollout
