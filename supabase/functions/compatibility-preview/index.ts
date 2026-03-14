import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createServiceClient, jsonResponse, requireUser } from '../_shared/http.ts';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const user = await requireUser(req);
        const limit = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('limit') ?? '8', 10), 1), 20);
        const service = createServiceClient();

        await service.rpc('refresh_taste_profile', { p_user_id: user.id });
        await service.rpc('refresh_compatibility_for_user', { p_user_id: user.id, p_limit: 50 });

        const { data, error } = await service
            .from('compatibility_scores')
            .select(`
                peer_user_id,
                score,
                reasons,
                calculated_at,
                peer:profiles!compatibility_scores_peer_user_id_fkey(id, display_name, avatar_url)
            `)
            .eq('user_id', user.id)
            .order('score', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        const results = (data ?? []).map((row: any) => ({
            peerUserId: row.peer_user_id,
            score: Number(row.score ?? 0),
            reasons: Array.isArray(row.reasons) ? row.reasons : [],
            calculatedAt: row.calculated_at,
            peer: row.peer
                ? {
                    id: row.peer.id,
                    displayName: row.peer.display_name,
                    avatarUrl: row.peer.avatar_url,
                }
                : undefined,
        }));

        return jsonResponse({ results });
    } catch (err: any) {
        const status = err?.message === 'Unauthorized' ? 401 : 500;
        return jsonResponse({ error: err?.message ?? 'Unknown error' }, status);
    }
});
