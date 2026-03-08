import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { igdbFetch } from '../_shared/igdb.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchHit {
    name?: string | null;
    character?: number | null;
    game?: number | null;
}

interface SearchResult {
    game: any;
    matchType: 'title' | 'company' | 'character';
    relevanceScore: number;
    matchLabel?: string;
}

function mapGame(g: any): any {
    return {
        providerId: String(g.id),
        provider: 'igdb',
        title: g.name,
        coverUrl: g.cover?.image_id
            ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
            : undefined,
        releaseDate: g.first_release_date
            ? new Date(g.first_release_date * 1000).toISOString().split('T')[0]
            : undefined,
        genres: (g.genres ?? []).map((x: any) => x.name),
        platforms: (g.platforms ?? []).map((x: any) => x.name),
        rating: g.rating ? Math.round(g.rating * 10) / 10 : undefined,
    };
}

function escapeIgdbString(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\s+/g, ' ')
        .trim();
}

function slugifyQuery(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeMatchText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function calculateEntityRelevance(candidate: string, query: string): number {
    const rawCandidate = candidate.toLowerCase();
    const rawQuery = query.toLowerCase();
    const normalizedCandidate = normalizeMatchText(candidate);
    const normalizedQuery = normalizeMatchText(query);

    if (!normalizedQuery) return 0;
    if (normalizedCandidate === normalizedQuery) return 1;
    if (rawCandidate === rawQuery) return 0.98;
    if (normalizedCandidate.startsWith(normalizedQuery)) return 0.95;
    if (rawCandidate.startsWith(rawQuery)) return 0.92;
    if (normalizedCandidate.includes(normalizedQuery)) return 0.88;
    if (rawCandidate.includes(rawQuery)) return 0.84;

    const queryTokens = rawQuery.split(/\s+/).filter(Boolean);
    if (queryTokens.length === 0) return 0.5;

    const tokenMatches = queryTokens.filter((token) => rawCandidate.includes(token)).length;
    return 0.55 + (tokenMatches / queryTokens.length) * 0.2;
}

function calculateTitleRelevance(game: any, query: string): number {
    return calculateEntityRelevance(game.name ?? '', query);
}

function mergeResults(allResults: SearchResult[]): SearchResult[] {
    const gameMap = new Map<number, SearchResult>();

    for (const result of allResults) {
        const gameId = result.game.id;
        const existing = gameMap.get(gameId);

        if (!existing || result.relevanceScore > existing.relevanceScore) {
            gameMap.set(gameId, result);
        }
    }

    return Array.from(gameMap.values()).sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
        }

        const ratingA = a.game.rating ?? 0;
        const ratingB = b.game.rating ?? 0;
        return ratingB - ratingA;
    });
}

function uniqueIds(ids: Array<number | null | undefined>): number[] {
    return Array.from(
        new Set(
            ids.filter((value): value is number => typeof value === 'number' && value > 0)
        )
    );
}

async function fetchGamesByIds(gameIds: number[]): Promise<any[]> {
    if (gameIds.length === 0) return [];

    return igdbFetch('/games', `
        fields id, name, cover.image_id, first_release_date, genres.name, platforms.name, rating;
        where id = (${gameIds.join(',')});
        sort rating desc;
        limit ${Math.min(gameIds.length, 50)};
    `);
}

async function loadSearchHits(query: string): Promise<SearchHit[]> {
    return igdbFetch('/search', `
        search "${query}";
        fields name, company, character, game;
        limit 20;
    `);
}

async function searchByTitle(query: string, limit: number): Promise<SearchResult[]> {
    try {
        const results = await igdbFetch('/games', `
            search "${query}";
            fields id, name, cover.image_id, first_release_date, genres.name, platforms.name, rating;
            limit ${limit};
        `);

        return results.map((game: any) => ({
            game,
            matchType: 'title' as const,
            relevanceScore: calculateTitleRelevance(game, query),
        }));
    } catch (err) {
        console.error('[searchByTitle]', err);
        return [];
    }
}

async function searchByCompany(query: string): Promise<SearchResult[]> {
    try {
        const slugQuery = slugifyQuery(query);
        const rawQuery = query.trim();
        const companyFilterParts = [
            slugQuery ? `slug = "${slugQuery}"` : '',
            slugQuery ? `slug ~ *"${slugQuery}"*` : '',
            rawQuery ? `name ~ *"${rawQuery}"*` : '',
        ].filter(Boolean);

        if (companyFilterParts.length === 0) return [];

        const companies = await igdbFetch('/companies', `
            fields id, name, slug, developed, published;
            where ${companyFilterParts.join(' | ')};
            limit 10;
        `);

        if (!companies || companies.length === 0) return [];

        const scoreByGame = new Map<number, { score: number; label: string }>();

        for (const company of companies) {
            const relevance = calculateEntityRelevance(company.name ?? '', query);
            const baseScore = 0.62 + relevance * 0.28;

            for (const gameId of company.developed ?? []) {
                const next = { score: baseScore, label: `Developer: ${company.name}` };
                const current = scoreByGame.get(gameId);
                if (!current || next.score > current.score) {
                    scoreByGame.set(gameId, next);
                }
            }

            for (const gameId of company.published ?? []) {
                const next = { score: baseScore - 0.03, label: `Publisher: ${company.name}` };
                const current = scoreByGame.get(gameId);
                if (!current || next.score > current.score) {
                    scoreByGame.set(gameId, next);
                }
            }
        }

        const games = await fetchGamesByIds(Array.from(scoreByGame.keys()).slice(0, 50));

        return games
            .filter((game: any) => scoreByGame.has(game.id))
            .map((game: any) => ({
                game,
                matchType: 'company' as const,
                relevanceScore: scoreByGame.get(game.id)!.score,
                matchLabel: scoreByGame.get(game.id)!.label,
            }));
    } catch (err) {
        console.error('[searchByCompany]', err);
        return [];
    }
}

async function searchByCharacter(query: string, hits: SearchHit[]): Promise<SearchResult[]> {
    try {
        const characterIds = uniqueIds(hits.map((hit) => hit.character)).slice(0, 8);
        if (characterIds.length === 0) return [];

        const characters = await igdbFetch('/characters', `
            fields id, name, games;
            where id = (${characterIds.join(',')});
            limit ${characterIds.length};
        `);

        const scoreByGame = new Map<number, { score: number; label: string }>();

        for (const character of characters) {
            const relevance = calculateEntityRelevance(character.name ?? '', query);
            const baseScore = 0.6 + relevance * 0.32;

            for (const gameId of character.games ?? []) {
                const next = { score: baseScore, label: `Character: ${character.name}` };
                const current = scoreByGame.get(gameId);
                if (!current || next.score > current.score) {
                    scoreByGame.set(gameId, next);
                }
            }
        }

        const games = await fetchGamesByIds(Array.from(scoreByGame.keys()).slice(0, 50));

        return games
            .filter((game: any) => scoreByGame.has(game.id))
            .map((game: any) => ({
                game,
                matchType: 'character' as const,
                relevanceScore: scoreByGame.get(game.id)!.score,
                matchLabel: scoreByGame.get(game.id)!.label,
            }));
    } catch (err) {
        console.error('[searchByCharacter]', err);
        return [];
    }
}

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

        const sanitizedQuery = escapeIgdbString(query);
        const searchHits = await loadSearchHits(sanitizedQuery).catch((err) => {
            console.error('[loadSearchHits]', err);
            return [];
        });

        const [titleResults, companyResults, characterResults] = await Promise.allSettled([
            searchByTitle(sanitizedQuery, limit),
            searchByCompany(sanitizedQuery),
            searchByCharacter(sanitizedQuery, searchHits),
        ]);

        const allResults: SearchResult[] = [];

        if (titleResults.status === 'fulfilled') {
            allResults.push(...titleResults.value);
        }
        if (companyResults.status === 'fulfilled') {
            allResults.push(...companyResults.value);
        }
        if (characterResults.status === 'fulfilled') {
            allResults.push(...characterResults.value);
        }

        const merged = mergeResults(allResults);
        const paginated = merged.slice(offset, offset + limit);
        const mapped = paginated.map((result) => ({
            ...mapGame(result.game),
            matchType: result.matchType,
            matchLabel: result.matchLabel,
        }));

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        if (mapped.length > 0) {
            const upsertData = mapped.map((game: any) => ({
                provider: 'igdb',
                provider_game_id: game.providerId,
                title: game.title,
                cover_url: game.coverUrl ?? null,
                release_date: game.releaseDate ?? null,
                genres: game.genres,
                platforms: game.platforms,
                rating: game.rating ?? null,
                updated_at: new Date().toISOString(),
            }));

            await supabase
                .from('games')
                .upsert(upsertData, { onConflict: 'provider,provider_game_id', ignoreDuplicates: false });
        }

        return new Response(
            JSON.stringify({ results: mapped, total: merged.length }),
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
