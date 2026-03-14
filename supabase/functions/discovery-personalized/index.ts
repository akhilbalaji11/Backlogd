import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createServiceClient, jsonResponse, requireUser } from '../_shared/http.ts';
import { igdbFetch, mapGame } from '../_shared/igdb.ts';

type DiscoveryMode = 'standard' | 'contrarian';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function computeOverlapScore(
    game: { genres?: string[]; platforms?: string[]; rating?: number },
    genreAffinity: Record<string, number>,
    platformAffinity: Record<string, number>
): number {
    const genreTotal = Object.values(genreAffinity).reduce((sum, value) => sum + value, 0) || 1;
    const platformTotal = Object.values(platformAffinity).reduce((sum, value) => sum + value, 0) || 1;

    const genreScore = (game.genres ?? [])
        .map((genre) => (genreAffinity[genre] ?? 0) / genreTotal)
        .reduce((sum, value) => sum + value, 0);

    const platformScore = (game.platforms ?? [])
        .map((platform) => (platformAffinity[platform] ?? 0) / platformTotal)
        .reduce((sum, value) => sum + value, 0);

    const ratingBonus = (game.rating ?? 60) / 100;
    return clamp(genreScore * 0.5 + platformScore * 0.25 + ratingBonus * 0.25, 0, 1);
}

function confidence(overlap: number, totalRated: number, feedbackSamples: number): number {
    return clamp(overlap * 0.55 + Math.min(totalRated / 20, 1) * 0.3 + Math.min(feedbackSamples / 25, 1) * 0.15, 0, 1);
}

function riskLevel(rating: number | undefined, score: number): 'low' | 'medium' | 'high' {
    const safeRating = rating ?? 65;
    if (safeRating >= 82 && score >= 0.65) return 'low';
    if (safeRating <= 65 || score < 0.4) return 'high';
    return 'medium';
}

function explain(game: { title: string; genres?: string[]; platforms?: string[] }, topGenres: string[]): string {
    const matchingGenre = topGenres.find((genre) => (game.genres ?? []).includes(genre));
    if (matchingGenre) return `Fits your ${matchingGenre} streak`;
    if ((game.platforms ?? []).length > 0) return `Matches your usual platforms`;
    return `Potential surprise pick for ${game.title}`;
}

function explainContrarian(game: { title: string; rating?: number; genres?: string[] }, topGenres: string[]): string {
    const matchingGenre = topGenres.find((genre) => (game.genres ?? []).includes(genre));
    const rating = typeof game.rating === 'number' ? Math.round(game.rating) : undefined;
    if (matchingGenre && rating) return `Underrated ${matchingGenre} pick (${rating}/100)`;
    if (rating) return `High-upside sleeper (${rating}/100 community score)`;
    return `Contrarian upside for ${game.title}`;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const user = await requireUser(req);
        const url = new URL(req.url);
        const mode = (url.searchParams.get('mode') ?? 'standard') as DiscoveryMode;
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '10', 10), 1), 20);
        const service = createServiceClient();

        await service.rpc('refresh_taste_profile', { p_user_id: user.id });

        const [{ data: profile, error: profileError }, { data: feedbackRows, error: feedbackError }] = await Promise.all([
            service.from('taste_profiles').select('*').eq('user_id', user.id).single(),
            service.from('discovery_feedback').select('id').eq('user_id', user.id).limit(200),
        ]);
        if (profileError) throw profileError;
        if (feedbackError) throw feedbackError;

        const genreAffinity = (profile?.genre_affinity ?? {}) as Record<string, number>;
        const platformAffinity = (profile?.platform_affinity ?? {}) as Record<string, number>;

        const [
            { data: historyReviews, error: historyReviewsError },
            { data: historyStatuses, error: historyStatusesError },
        ] = await Promise.all([
            service.from('reviews')
                .select('game:games(provider_game_id)')
                .eq('user_id', user.id),
            service.from('user_game_status')
                .select('game:games(provider_game_id)')
                .eq('user_id', user.id),
        ]);
        if (historyReviewsError) throw historyReviewsError;
        if (historyStatusesError) throw historyStatusesError;

        const excludeIds = new Set<string>([
            ...(historyReviews ?? []).map((row: any) => row.game?.provider_game_id).filter(Boolean),
            ...(historyStatuses ?? []).map((row: any) => row.game?.provider_game_id).filter(Boolean),
        ]);

        const { data: cachedCandidates, error } = await service
            .from('games')
            .select('provider_game_id,title,cover_url,release_date,genres,platforms,rating')
            .order('rating', { ascending: false })
            .limit(120);

        if (error) throw error;
        const localCandidates = cachedCandidates ?? [];

        let candidates = localCandidates;
        if (localCandidates.length < 25) {
            try {
                const remote = await igdbFetch('/games', `
                    fields id, name, cover.image_id, first_release_date, genres.name, platforms.name, rating, summary;
                    where rating > 65;
                    sort rating desc;
                    limit 60;
                `);

                const mappedRemote = (remote ?? []).map((row: any) => mapGame(row));
                const existing = new Set(localCandidates.map((row: any) => row.provider_game_id));
                const additional = mappedRemote
                    .filter((row: any) => !existing.has(row.providerId))
                    .map((row: any) => ({
                        provider_game_id: row.providerId,
                        title: row.title,
                        cover_url: row.coverUrl ?? null,
                        release_date: row.releaseDate ?? null,
                        genres: row.genres ?? [],
                        platforms: row.platforms ?? [],
                        rating: row.rating ?? null,
                    }));

                if (additional.length > 0) {
                    await service.from('games').upsert(
                        additional.map((row: any) => ({
                            provider: 'igdb',
                            provider_game_id: row.provider_game_id,
                            title: row.title,
                            cover_url: row.cover_url,
                            release_date: row.release_date,
                            genres: row.genres,
                            platforms: row.platforms,
                            rating: row.rating,
                            updated_at: new Date().toISOString(),
                        })),
                        { onConflict: 'provider,provider_game_id' }
                    );
                }

                candidates = [...localCandidates, ...additional];
            } catch {
                candidates = localCandidates;
            }
        }

        const topGenres = Object.entries(genreAffinity)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([genre]) => genre);

        const feedbackSamples = (feedbackRows ?? []).length;
        const totalRated = (historyReviews ?? []).length;
        const filteredCandidates = (candidates ?? [])
            .filter((game: any) => !excludeIds.has(game.provider_game_id))
            .filter((game: any) => {
                if (mode !== 'contrarian') return true;
                const rating = Number(game.rating ?? 0);
                // Contrarian focuses on less obvious gems, not top consensus picks.
                return rating >= 55 && rating <= 84;
            });

        const scored = filteredCandidates
            .map((game: any) => {
                const overlap = computeOverlapScore({
                    genres: game.genres ?? [],
                    platforms: game.platforms ?? [],
                    rating: game.rating ?? undefined,
                }, genreAffinity, platformAffinity);

                const ratingNorm = clamp((Number(game.rating ?? 60) - 55) / 45, 0, 1);
                const contrarianPotential = 1 - ratingNorm;
                const score = mode === 'contrarian'
                    ? clamp(overlap * 0.72 + contrarianPotential * 0.28, 0, 1)
                    : clamp(overlap, 0, 1);
                const conf = confidence(score, totalRated, feedbackSamples);

                return {
                    providerId: game.provider_game_id,
                    provider: 'igdb',
                    title: game.title,
                    coverUrl: game.cover_url ?? undefined,
                    releaseDate: game.release_date ?? undefined,
                    genres: game.genres ?? [],
                    platforms: game.platforms ?? [],
                    rating: game.rating ?? undefined,
                    score,
                    confidence: conf,
                    risk: riskLevel(game.rating ?? undefined, conf),
                    reason: mode === 'contrarian'
                        ? explainContrarian(game, topGenres)
                        : explain(game, topGenres),
                };
            })
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (mode === 'contrarian') {
                    return (a.rating ?? 0) - (b.rating ?? 0);
                }
                return (b.rating ?? 0) - (a.rating ?? 0);
            })
            .slice(0, limit);

        if (scored.length > 0) {
            await service.from('discovery_impressions').insert(
                scored.map((item) => ({
                    user_id: user.id,
                    provider_game_id: item.providerId,
                    surface: mode === 'contrarian' ? 'discover_contrarian' : 'discover_personalized',
                    reason: {
                        score: item.score,
                        confidence: item.confidence,
                        risk: item.risk,
                        reason: item.reason,
                    },
                }))
            );
        }

        return jsonResponse({ mode, results: scored });
    } catch (err: any) {
        const status = err?.message === 'Unauthorized' ? 401 : 500;
        return jsonResponse({ error: err?.message ?? 'Unknown error' }, status);
    }
});
