// API client — thin wrapper over Supabase Edge Functions
// All game data flows through here; keys stay server-side.

import type { GameDetail, GameSearchResult } from '../domain/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const EDGE_BASE = `${supabaseUrl}/functions/v1`;

async function edgeFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${EDGE_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`Edge function error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

// ---- Game Metadata API ----
export const gamesApi = {
    search: (query: string, page = 1): Promise<{ results: GameSearchResult[] }> =>
        edgeFetch(`/games-search?q=${encodeURIComponent(query)}&page=${page}`),

    getById: (providerId: string): Promise<GameDetail> =>
        edgeFetch(`/games-detail?id=${encodeURIComponent(providerId)}`),
};

// ---- AI Tags API (feature-flagged) ----
export const aiApi = {
    tagReview: (
        reviewText: string,
        gameTitle: string
    ): Promise<{ tags: string[] }> =>
        edgeFetch('/ai-tag-review', {
            method: 'POST',
            body: JSON.stringify({ review_text: reviewText, game_title: gameTitle }),
        }),
};
