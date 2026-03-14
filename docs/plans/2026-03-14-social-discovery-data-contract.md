# Backlogd Social + Discovery Data Contract (v1)

## Scope

This contract defines minimal production-ready primitives for:
- Taste profiles and compatibility
- Explainable discovery with contrarian mode
- Social circles and backlog challenges
- Feed ranking rationale

## New Tables (v1)

### `taste_profiles`
- `user_id uuid primary key references profiles(id)`
- `genre_affinity jsonb not null default '{}'`
- `platform_affinity jsonb not null default '{}'`
- `mood_affinity jsonb not null default '{}'`
- `novelty_preference numeric(4,3) not null default 0.5`
- `challenge_preference numeric(4,3) not null default 0.5`
- `social_weight numeric(4,3) not null default 0.5`
- `profile_version int not null default 1`
- `updated_at timestamptz not null default now()`

### `taste_signals`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id) on delete cascade`
- `signal_type text not null` (`review`, `status`, `session`, `list`, `feedback`)
- `signal_weight numeric(5,3) not null`
- `source_entity_id uuid`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

### `compatibility_scores`
- `user_id uuid not null references profiles(id) on delete cascade`
- `peer_user_id uuid not null references profiles(id) on delete cascade`
- `score numeric(5,3) not null`
- `reasons jsonb not null default '[]'`
- `calculated_at timestamptz not null default now()`
- primary key (`user_id`, `peer_user_id`)

### `discovery_impressions`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id) on delete cascade`
- `provider_game_id text not null`
- `surface text not null` (`discover_personalized`, `discover_contrarian`, `feed_context`)
- `reason jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

### `discovery_feedback`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id) on delete cascade`
- `provider_game_id text not null`
- `feedback_type text not null` (`open`, `skip`, `save`, `played`)
- `source text not null` (`discover`, `feed`, `circle`)
- `created_at timestamptz not null default now()`

### `social_circles`
- `id uuid primary key default gen_random_uuid()`
- `owner_id uuid not null references profiles(id) on delete cascade`
- `name text not null`
- `description text`
- `visibility text not null default 'private'` (`private`, `friends`)
- `created_at timestamptz not null default now()`

### `circle_members`
- `circle_id uuid not null references social_circles(id) on delete cascade`
- `user_id uuid not null references profiles(id) on delete cascade`
- `role text not null default 'member'` (`owner`, `member`)
- `joined_at timestamptz not null default now()`
- primary key (`circle_id`, `user_id`)

### `circle_challenges`
- `id uuid primary key default gen_random_uuid()`
- `circle_id uuid not null references social_circles(id) on delete cascade`
- `title text not null`
- `goal_type text not null` (`finish_count`, `session_minutes`)
- `goal_target int not null`
- `start_date date not null`
- `end_date date not null`
- `created_by uuid not null references profiles(id) on delete cascade`
- `created_at timestamptz not null default now()`

### `challenge_progress`
- `challenge_id uuid not null references circle_challenges(id) on delete cascade`
- `user_id uuid not null references profiles(id) on delete cascade`
- `progress_value int not null default 0`
- `last_event_at timestamptz not null default now()`
- primary key (`challenge_id`, `user_id`)

## New Edge API Contracts

### `GET /functions/v1/compatibility-preview?user_id=<uuid>&limit=<n>`
- Returns friend compatibility sorted by score
- Includes reasons payload for explainability

### `GET /functions/v1/discovery-personalized?mode=<standard|contrarian>&limit=<n>`
- Returns game candidates with `score`, `confidence`, `risk`, and `reason`
- Uses taste profile + prior feedback

### `POST /functions/v1/circle-challenges`
- Action-based endpoint with `action`:
  - `create_circle`
  - `join_circle`
  - `create_challenge`
  - `update_progress`

### `POST /functions/v1/feed-rank`
- Ranks incoming activity events with reason chips
- Inputs: event list + optional user context payload

## Client API Additions

- `discoveryApi.getPersonalized(mode, limit)`
- `socialApi.getCompatibility(userId, limit)`
- `socialApi.circleAction(payload)`
- `feedApi.rank(events, limit)`
- `telemetryApi.trackDiscoveryFeedback(payload)`

## Rollout Guardrails

- All new surfaces are feature-flag gated from app config
- Default fallback remains current discover/feed behavior
- RLS policy defaults deny writes unless owner/member rules are satisfied
