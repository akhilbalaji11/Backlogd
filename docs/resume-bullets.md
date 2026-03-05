# Backlogd resume bullets.md

## Resume Bullets

### Full-Stack Mobile (iOS)
- Built an **iOS-first social game-logging app** with React Native (Expo SDK 55), Expo Router, and TypeScript, featuring a polished dark-mode UI with NativeWind and custom design tokens
- Implemented **full Supabase backend**: PostgreSQL schema with 11 tables, Row Level Security on all user-owned data, Storage bucket for avatar uploads, and automated profile creation via database trigger
- Architected a **clean separation of concerns**: domain models → data access repositories → TanStack Query hooks → React component layer, with end-to-end type safety

### API Integration
- Built **3 Supabase Edge Functions (Deno)** to proxy the IGDB game metadata API, handling Twitch OAuth app-access token caching transparently — zero API secrets in the client bundle
- Implemented a **provider interface pattern** (`GameProvider`) decoupling the app from any specific game data source, enabling IGDB → any future provider swaps without touching UI code
- Configured a **24-hour server-side cache** for game metadata in Postgres, reducing redundant IGDB API calls and improving offline-friendly behavior

### AI / Machine Learning
- Designed a **two-layer recommendation engine**: (1) a content-based recommender using TF-IDF–style genre/platform/theme frequency vectors from user ratings and play history, returning top-5 picks with human-readable explanations; (2) an optional LLM layer (GPT-4o-mini via OpenAI) for smart review tagging, with graceful deterministic fallback
- Feature-flagged the LLM layer via Edge Function environment variables — app fully functional and testable with zero paid AI spend

### Architecture & Security
- Enforced **Row Level Security** for all 11 tables: activity feed scoped to followed users, private diary entries invisible to others, list visibility controlled by `is_public` flag
- Wrote **unit tests** for the recommender's preference vector, scoring, and explanation generation using Jest
