# Social + Discovery Rollout Quality Gates

## Feature Flags

`app_feature_flags` keys:
- `taste_graph`
- `discovery_personalized`
- `social_circles`
- `feed_ranker`

All flags default to disabled with `rollout_pct = 0`.

## Rollout Order

1. Enable `taste_graph` at 10% for internal users.
2. Enable `discovery_personalized` at 5%, then 25%, then 50%.
3. Enable `social_circles` at 10% after challenge table health checks.
4. Enable `feed_ranker` after observing stable discovery metrics.

## SQL Health Checks

```sql
-- discovery engagement
select feedback_type, count(*)
from public.discovery_feedback
where created_at > now() - interval '7 days'
group by feedback_type
order by count(*) desc;

-- impressions volume by surface
select surface, count(*)
from public.discovery_impressions
where created_at > now() - interval '7 days'
group by surface;

-- challenge activity
select count(*) as challenge_events
from public.activity_events
where type = 'challenge'
  and created_at > now() - interval '7 days';
```

## Quality Gates

- Error rate for new edge functions < 1% before ramping next stage
- No RLS policy regressions in manual smoke script `supabase/tests/rls_phase1_smoke.sql`
- Discovery feedback signal volume > impressions * 0.05 before widening rollout
- No P95 latency regression > 20% on discover load path
