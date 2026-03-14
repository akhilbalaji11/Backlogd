import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

export function createServiceClient() {
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
}

export function createAuthedClient(req: Request) {
    const authHeader = req.headers.get('Authorization') ?? '';
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
    );
}

export async function requireUser(req: Request): Promise<{ id: string }> {
    const authed = createAuthedClient(req);
    const { data: { user }, error } = await authed.auth.getUser();
    if (error || !user) {
        throw new Error('Unauthorized');
    }
    return { id: user.id };
}
