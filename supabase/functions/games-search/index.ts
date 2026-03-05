import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { igdbFetch, mapGame } from '../_shared/igdb.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const query = url.searchParams.get('q')?.trim();
        const page = parseInt(url.searchParams.get('page') ?? '1', 10);
        const limit = 20;
        const offset = (page - 1) * limit;

        if (!query) {
            return new Response(
                JSON.stringify({ error: 'Missing q parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // IGDB search using Apicalypse query language
        const igdbQuery = `
      search "${query}";
      fields id, name, cover.image_id, first_release_date, genres.name, platforms.name, themes.name, rating, summary;
      limit ${limit};
      offset ${offset};
    `;

        const results = await igdbFetch('/games', igdbQuery);
        const mapped = results.map(mapGame);

        // Cache results into Supabase games table
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        if (mapped.length > 0) {
            const upsertData = mapped.map((g: any) => ({
                provider: 'igdb',
                provider_game_id: g.providerId,
                title: g.title,
                cover_url: g.coverUrl ?? null,
                release_date: g.releaseDate ?? null,
                genres: g.genres,
                platforms: g.platforms,
                themes: g.themes,
                description: g.description ?? null,
                rating: g.rating ?? null,
                similar_game_ids: g.similarGameIds,
                updated_at: new Date().toISOString(),
            }));

            await supabase
                .from('games')
                .upsert(upsertData, { onConflict: 'provider,provider_game_id', ignoreDuplicates: false });
        }

        return new Response(
            JSON.stringify({ results: mapped }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        console.error('[games-search]', err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
