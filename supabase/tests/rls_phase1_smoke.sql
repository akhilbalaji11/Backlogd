-- Phase 1 RLS smoke checks (run in SQL editor with JWT context if available)
-- These checks are intended as a manual verification script.

-- 1) Self can upsert taste profile through RPC
select public.refresh_taste_profile(auth.uid());

-- 2) Self can read own profile
select *
from public.taste_profiles
where user_id = auth.uid();

-- 3) Self can insert own discovery feedback
insert into public.discovery_feedback (user_id, provider_game_id, feedback_type, source)
values (auth.uid(), '12345', 'open', 'discover');

-- 4) Self cannot insert discovery feedback for another user (should fail under RLS)
-- replace UUID with a real different profile id in your project to validate deny behavior
-- insert into public.discovery_feedback (user_id, provider_game_id, feedback_type, source)
-- values ('00000000-0000-0000-0000-000000000000', '12345', 'open', 'discover');

-- 5) Self can refresh compatibility set and read own rows
select public.refresh_compatibility_for_user(auth.uid(), 20);

select *
from public.compatibility_scores
where user_id = auth.uid()
order by score desc
limit 10;
