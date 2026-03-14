import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createAuthedClient, jsonResponse, requireUser } from '../_shared/http.ts';

type Payload =
    | { action: 'create_circle'; name: string; description?: string; visibility?: 'private' | 'friends' }
    | { action: 'join_circle'; circleId: string }
    | { action: 'create_challenge'; circleId: string; title: string; goalType: 'finish_count' | 'session_minutes'; goalTarget: number; startDate: string; endDate: string }
    | { action: 'update_progress'; challengeId: string; progressDelta: number }
    | { action: 'list_my_circles' };

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        if (req.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        const user = await requireUser(req);
        const client = createAuthedClient(req);
        const body = await req.json() as Payload;

        if (body.action === 'create_circle') {
            const { data: circle, error } = await client
                .from('social_circles')
                .insert({
                    owner_id: user.id,
                    name: body.name,
                    description: body.description ?? null,
                    visibility: body.visibility ?? 'private',
                })
                .select('*')
                .single();
            if (error) throw error;

            const { error: memberError } = await client.from('circle_members').insert({
                circle_id: circle.id,
                user_id: user.id,
                role: 'owner',
            });
            if (memberError) {
                // Best-effort compensation: avoid orphan circles without an owner membership row.
                await client.from('social_circles').delete().eq('id', circle.id).eq('owner_id', user.id);
                throw memberError;
            }

            return jsonResponse({ result: circle });
        }

        if (body.action === 'join_circle') {
            const { error } = await client
                .from('circle_members')
                .upsert({
                    circle_id: body.circleId,
                    user_id: user.id,
                    role: 'member',
                }, { onConflict: 'circle_id,user_id' });
            if (error) throw error;
            return jsonResponse({ ok: true });
        }

        if (body.action === 'create_challenge') {
            const { data, error } = await client
                .from('circle_challenges')
                .insert({
                    circle_id: body.circleId,
                    title: body.title,
                    goal_type: body.goalType,
                    goal_target: body.goalTarget,
                    start_date: body.startDate,
                    end_date: body.endDate,
                    created_by: user.id,
                })
                .select('*')
                .single();
            if (error) throw error;

            return jsonResponse({ result: data });
        }

        if (body.action === 'update_progress') {
            const { data: current, error: getErr } = await client
                .from('challenge_progress')
                .select('*')
                .eq('challenge_id', body.challengeId)
                .eq('user_id', user.id)
                .maybeSingle();
            if (getErr) throw getErr;

            const nextValue = Math.max(0, Number(current?.progress_value ?? 0) + Number(body.progressDelta ?? 0));
            const { data, error } = await client
                .from('challenge_progress')
                .upsert({
                    challenge_id: body.challengeId,
                    user_id: user.id,
                    progress_value: nextValue,
                    last_event_at: new Date().toISOString(),
                }, { onConflict: 'challenge_id,user_id' })
                .select('*')
                .single();
            if (error) throw error;

            await client.from('activity_events').insert({
                actor_id: user.id,
                type: 'challenge',
                entity_id: body.challengeId,
                metadata: { progress: data.progress_value },
            });

            return jsonResponse({ result: data });
        }

        const { data: circles, error } = await client
            .from('circle_members')
            .select('circle:social_circles(*)')
            .eq('user_id', user.id)
            .order('joined_at', { ascending: false });
        if (error) throw error;

        return jsonResponse({
            results: (circles ?? []).map((row: any) => row.circle).filter(Boolean),
        });
    } catch (err: any) {
        const status = err?.message === 'Unauthorized' ? 401 : 500;
        return jsonResponse({ error: err?.message ?? 'Unknown error' }, status);
    }
});
