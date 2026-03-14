import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createServiceClient, jsonResponse, requireUser } from '../_shared/http.ts';

type FeedEvent = {
    id: string;
    actorId: string;
    type: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function scoreEvent(event: FeedEvent, compatibilityScore = 0.3) {
    const createdAtMs = new Date(event.createdAt).getTime();
    const ageHours = Number.isFinite(createdAtMs)
        ? Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60))
        : 48;

    const freshness = clamp(1 - ageHours / 48, 0, 1);
    const challengeBoost = event.type === 'challenge' ? 0.2 : 0;
    const score = freshness * 0.5 + compatibilityScore * 0.35 + challengeBoost * 0.15;

    const reasonChips: string[] = [];
    if (freshness >= 0.7) reasonChips.push('Fresh');
    if (compatibilityScore >= 0.65) reasonChips.push('Taste overlap');
    if (event.type === 'challenge') reasonChips.push('Circle challenge');
    if (reasonChips.length === 0) reasonChips.push('From your network');

    return { score, reasonChips };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        if (req.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        const user = await requireUser(req);
        const body = await req.json() as { events: FeedEvent[]; limit?: number };
        const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 25);

        const service = createServiceClient();
        const actorIds = Array.from(new Set((body.events ?? []).map((event) => event.actorId))).filter(Boolean);

        let compatibilityByActor = new Map<string, number>();
        if (actorIds.length > 0) {
            const { data } = await service
                .from('compatibility_scores')
                .select('peer_user_id, score')
                .eq('user_id', user.id)
                .in('peer_user_id', actorIds);

            compatibilityByActor = new Map(
                (data ?? []).map((row: any) => [row.peer_user_id, Number(row.score ?? 0)])
            );
        }

        const ranked = (body.events ?? [])
            .map((event) => {
                const computed = scoreEvent(event, compatibilityByActor.get(event.actorId) ?? 0.3);
                return {
                    ...event,
                    score: computed.score,
                    reasonChips: computed.reasonChips,
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return jsonResponse({ results: ranked });
    } catch (err: any) {
        const status = err?.message === 'Unauthorized' ? 401 : 500;
        return jsonResponse({ error: err?.message ?? 'Unknown error' }, status);
    }
});
