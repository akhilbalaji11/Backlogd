-- Seed data for demo/testing
-- Run AFTER all migrations. Uses fake UUIDs for demo users.
-- NOTE: You'll need to create real auth users via Supabase Auth first,
-- then update the UUIDs below to match your actual user IDs.

-- ============================================================
-- DEMO GAMES (pre-cached from IGDB)
-- ============================================================
INSERT INTO public.games (id, provider, provider_game_id, title, cover_url, release_date, genres, platforms, rating)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'igdb', '1942', 'Hades',
   'https://images.igdb.com/igdb/image/upload/t_cover_big/co4b0c.jpg',
   '2020-09-17', ARRAY['Roguelike', 'Action', 'Dungeon Crawler'],
   ARRAY['PC', 'Switch', 'PS4', 'Xbox'], 87.5),

  ('a1000000-0000-0000-0000-000000000002', 'igdb', '119388', 'Elden Ring',
   'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
   '2022-02-25', ARRAY['RPG', 'Action', 'Open World'],
   ARRAY['PC', 'PS5', 'Xbox'], 93.2),

  ('a1000000-0000-0000-0000-000000000003', 'igdb', '240720', 'Hollow Knight',
   'https://images.igdb.com/igdb/image/upload/t_cover_big/co1rba.jpg',
   '2017-02-24', ARRAY['Metroidvania', 'Action', 'Platformer'],
   ARRAY['PC', 'Switch'], 88.0),

  ('a1000000-0000-0000-0000-000000000004', 'igdb', '1020', 'Stardew Valley',
   'https://images.igdb.com/igdb/image/upload/t_cover_big/co5s5v.jpg',
   '2016-02-26', ARRAY['Simulation', 'RPG', 'Farming'],
   ARRAY['PC', 'Switch', 'PS4', 'Xbox', 'iOS', 'Android'], 86.0),

  ('a1000000-0000-0000-0000-000000000005', 'igdb', '113112', 'Celeste',
   'https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg',
   '2018-01-25', ARRAY['Platformer', 'Indie', 'Adventure'],
   ARRAY['PC', 'Switch', 'PS4', 'Xbox'], 91.3)
ON CONFLICT (provider, provider_game_id) DO NOTHING;

-- ============================================================
-- INSTRUCTIONS: After inserting real auth users, run:
-- ============================================================

-- 1. Create profile rows (replace UUID with real auth.uid from Supabase Auth):
-- INSERT INTO public.profiles (id, display_name, bio, favorite_platforms)
-- VALUES ('YOUR-USER-UUID', 'DemoPlayer', 'I love roguelikes!', ARRAY['PC', 'Switch']);

-- 2. Add some statuses:
-- INSERT INTO public.user_game_status (user_id, game_id, status)
-- VALUES
--   ('YOUR-USER-UUID', 'a1000000-0000-0000-0000-000000000001', 'played'),
--   ('YOUR-USER-UUID', 'a1000000-0000-0000-0000-000000000002', 'playing'),
--   ('YOUR-USER-UUID', 'a1000000-0000-0000-0000-000000000003', 'backlog');

-- 3. Add a review:
-- INSERT INTO public.reviews (user_id, game_id, rating, review_text, spoiler)
-- VALUES (
--   'YOUR-USER-UUID',
--   'a1000000-0000-0000-0000-000000000001',
--   5.0,
--   'Absolutely incredible roguelike. The music, the story, the gameplay loop - perfection.',
--   false
-- );
