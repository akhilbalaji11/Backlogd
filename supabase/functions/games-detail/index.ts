import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { igdbFetch, mapGame } from '../_shared/igdb.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CachedExtras = {
    involvedCompanies?: Array<{
        company?: { id?: number; name?: string };
        developer?: boolean;
        publisher?: boolean;
        porting?: boolean;
    }>;
    characterCredits?: Array<{
        id?: number;
        name?: string;
        imageUrl?: string;
    }>;
};

function mapCharacterCredits(characters: any[]) {
    return (characters ?? [])
        .filter((character) => typeof character?.id === 'number' && typeof character?.name === 'string')
        .map((character) => ({
            id: character.id,
            name: character.name,
            imageUrl: character.mug_shot?.image_id
                ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${character.mug_shot.image_id}.jpg`
                : undefined,
        }));
}

function mapCachedGame(cached: any) {
    const extras: CachedExtras = cached.raw_json && typeof cached.raw_json === 'object'
        ? cached.raw_json
        : {};

    return {
        id: cached.id,
        providerId: cached.provider_game_id,
        provider: cached.provider,
        title: cached.title,
        coverUrl: cached.cover_url,
        releaseDate: cached.release_date,
        genres: cached.genres ?? [],
        platforms: cached.platforms ?? [],
        themes: cached.themes ?? [],
        description: cached.description,
        rating: cached.rating,
        similarGameIds: cached.similar_game_ids ?? [],
        involvedCompanies: extras.involvedCompanies ?? [],
        characterCredits: extras.characterCredits ?? [],
    };
}

function hasEnhancedCache(cached: any): boolean {
    const extras: CachedExtras = cached.raw_json && typeof cached.raw_json === 'object'
        ? cached.raw_json
        : {};

    return Array.isArray(extras.involvedCompanies) && Array.isArray(extras.characterCredits);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const providerId = url.searchParams.get('id');

        if (!providerId) {
            return new Response(
                JSON.stringify({ error: 'Missing id parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: cached } = await supabase
            .from('games')
            .select('*')
            .eq('provider', 'igdb')
            .eq('provider_game_id', providerId)
            .single();

        if (cached) {
            const age = Date.now() - new Date(cached.updated_at).getTime();
            if (age < 24 * 60 * 60 * 1000 && hasEnhancedCache(cached)) {
                return new Response(
                    JSON.stringify(mapCachedGame(cached)),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        const igdbQuery = `
            fields id, name, cover.image_id, first_release_date, genres.name, platforms.name,
                   themes.name, rating, summary, similar_games, storyline,
                   involved_companies.company.name,
                   involved_companies.developer,
                   involved_companies.publisher,
                   involved_companies.porting;
            where id = ${providerId};
            limit 1;
        `;

        const [results, characters] = await Promise.all([
            igdbFetch('/games', igdbQuery),
            igdbFetch('/characters', `
                fields id, name, mug_shot.image_id;
                where games = (${providerId});
                limit 10;
            `).catch((err) => {
                console.error('[games-detail.characters]', err);
                return [];
            }),
        ]);

        if (!results || results.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Game not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const mapped = {
            ...mapGame(results[0]),
            characterCredits: mapCharacterCredits(characters),
        };

        const rawJson = {
            involvedCompanies: mapped.involvedCompanies ?? [],
            characterCredits: mapped.characterCredits ?? [],
        };

        const { data: upserted } = await supabase
            .from('games')
            .upsert({
                provider: 'igdb',
                provider_game_id: mapped.providerId,
                title: mapped.title,
                cover_url: mapped.coverUrl ?? null,
                release_date: mapped.releaseDate ?? null,
                genres: mapped.genres,
                platforms: mapped.platforms,
                themes: mapped.themes ?? [],
                description: mapped.description ?? null,
                rating: mapped.rating ?? null,
                similar_game_ids: mapped.similarGameIds ?? [],
                raw_json: rawJson,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'provider,provider_game_id' })
            .select('id')
            .single();

        return new Response(
            JSON.stringify({ ...mapped, id: upserted?.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        console.error('[games-detail]', err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
