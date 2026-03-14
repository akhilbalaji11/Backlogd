# Backlogd

> The social quest log for gamers with 200 unplayed titles and confidence anyway.

Backlogd is a mobile app for tracking what you play, what you plan to play, and what you insist you will totally finish this weekend.

It is built with Expo + React Native, powered by Supabase, and pulls game metadata from IGDB through secure edge functions.

## Why This Exists

Letterboxd is great for movies.
Steam libraries are great for denial.
Backlogd is the middle path.

You can:
- Track statuses: `played`, `playing`, `backlog`, `wishlist`
- Rate and review games
- Log diary sessions
- Build custom lists
- See friend activity
- Get personalized recommendations

## Current Feature State

What is implemented in this repo today:
- Auth flow with Supabase (`sign up`, `sign in`, `sign out`)
- Profile setup with avatar upload + favorite platforms
- Game search from IGDB via `games-search` edge function
- Filtered game browse via `games-browse` edge function
- Game detail screen via `games-detail` edge function with DB caching
- Status updates + review/rating posting
- Activity feed (reviews, ratings, status changes)
- Diary timeline with session logging
- List creation and list visibility (public/private)
- Deterministic recommendation engine with unit tests
- Optional AI review tagging edge function (`ai-tag-review`)
- Taste graph foundation tables + compatibility preview edge function
- Explainable discovery edge function (`discovery-personalized`) with contrarian mode support
- Social circles/challenges edge function (`circle-challenges`)
- Feed ranking edge function (`feed-rank`) for rationale-based activity ordering

What is scaffolded but not fully wired in UI yet:
- Follow/unfollow UI flows
- List item management screens
- AI tag suggestions inside the review editor

## Stack

| Layer | Tech |
|---|---|
| Mobile | Expo SDK 54 + React Native 0.81 + React 19 |
| Routing | Expo Router |
| State | TanStack Query + Zustand |
| Forms/Validation | React Hook Form + Zod |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Game Data | IGDB (Twitch OAuth) |
| Optional AI | OpenAI `gpt-4o-mini` in edge function |
| Language | TypeScript (app + functions) |

## Repo Layout

```text
Backlogd/
  apps/mobile/                 Expo app
    app/                       Router screens (auth, tabs, modals)
    src/
      components/              Reusable UI
      domain/                  Core types
      lib/                     API clients, repos, recommender
      stores/                  Zustand auth store
      styles/                  Tokens + global styles
  supabase/
    migrations/                SQL schema + RLS policies
    functions/                 Edge functions (Deno)
    seed.sql                   Optional seed data
  docs/
    resume-bullets.md
  deploy-functions.ps1         PowerShell deploy helper
  redeploy-search.ps1          PowerShell partial deploy helper
```

## Quick Start (Windows + Expo Go)

### 1. Install dependencies

```powershell
git clone https://github.com/akhilbalaji11/Backlogd.git
cd Backlogd\apps\mobile
npm install
```

### 2. Configure mobile env

```powershell
copy .env.example .env
```

Set:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3. Create Supabase project and run migrations

In Supabase SQL Editor, run these in order:
1. `supabase/migrations/001_profiles_follows.sql`
2. `supabase/migrations/002_games_statuses_reviews.sql`
3. `supabase/migrations/003_lists_activity.sql`
4. `supabase/migrations/004_manual_games_insert_policy.sql`
5. `supabase/migrations/005_play_sessions_first_time.sql`
6. `supabase/migrations/006_diary_and_lists_enhancements.sql`
7. `supabase/migrations/007_taste_and_discovery_foundation.sql`
8. `supabase/migrations/008_social_circles_and_challenges.sql`
9. `supabase/migrations/009_rollout_hardening.sql`

Optional: run `supabase/seed.sql` after migrations if you want demo game data.

### 4. Configure edge function secrets

In Supabase Dashboard -> Edge Functions -> Manage Secrets:
- `IGDB_CLIENT_ID`
- `IGDB_CLIENT_SECRET`
- `OPENAI_API_KEY` (optional)

### 5. Deploy edge functions

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy games-search
supabase functions deploy games-browse
supabase functions deploy games-detail
supabase functions deploy ai-tag-review
supabase functions deploy compatibility-preview
supabase functions deploy discovery-personalized
supabase functions deploy circle-challenges
supabase functions deploy feed-rank
```

### 6. Run the app

```powershell
cd apps\mobile
npx expo start
```

Then scan the QR code in Expo Go on your phone.

## Dev Commands

Run these from `apps/mobile`:

```powershell
npm run start
npm run type-check
npm run test
```

## Recommendation System

Backlogd uses a two-layer approach:

1. Deterministic recommender:
- Builds user preference vectors from reviews/statuses
- Scores IGDB candidates by genre/platform overlap + rating
- Returns top recommendations with readable reasons

2. Optional AI tags:
- `ai-tag-review` calls OpenAI when `OPENAI_API_KEY` is set
- Falls back to deterministic keyword tagging when unset

So yes, your hot take on a boss fight can become metadata.

## Data Model (High Level)

Main tables:
- `profiles`
- `follows`
- `games`
- `user_game_status`
- `reviews`
- `review_likes`
- `review_comments`
- `play_sessions`
- `lists`
- `list_items`
- `activity_events`
 
 
RLS is enabled, and user-owned resources are scoped to `auth.uid()`.

## Roadmap Boss Fights

- Wire follow/unfollow controls in profile/discover UI
- Add list detail screen and list item CRUD
- Integrate AI tag suggestions directly into review editor
- Add richer profile stats (currently placeholder values)

## License

No license file is currently included.
