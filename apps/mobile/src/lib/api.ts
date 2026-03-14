// API client — thin wrapper over Supabase Edge Functions
// All game data flows through here; keys stay server-side.

import type {
    BrowseFilters,
    CompatibilityPreview,
    DiscoveryRecommendation,
    GameDetail,
    GameSearchResult,
    RankedFeedEvent,
    SocialCircle,
} from '../domain/types';
import { supabase } from './supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const EDGE_BASE = `${supabaseUrl}/functions/v1`;

const DEFAULT_TIMEOUT = 15000; // 15 seconds

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    // Race between fetch and timeout
    return Promise.race([
        fetch(url, options),
        timeoutPromise,
    ]) as Promise<Response>;
}

async function edgeFetch<T>(path: string, options?: RequestInit & { timeout?: number }): Promise<T> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const res = await fetchWithTimeout(`${EDGE_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            ...options?.headers,
        },
    }, timeout);

    if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`Edge function error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

async function edgeFetchAuthenticated<T>(path: string, options?: RequestInit & { timeout?: number }): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
        throw new Error('You need to be signed in for this action.');
    }
    return edgeFetch<T>(path, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options?.headers ?? {}),
        },
    });
}

// ---- Game Metadata API ----
export const gamesApi = {
    search: (query: string, page = 1): Promise<{ results: GameSearchResult[] }> =>
        edgeFetch(`/games-search?q=${encodeURIComponent(query)}&page=${page}`),

    getById: (providerId: string): Promise<GameDetail> =>
        edgeFetch(`/games-detail?id=${encodeURIComponent(providerId)}`),

    browse: (filters: BrowseFilters): Promise<{ results: GameSearchResult[] }> => {
        const params = new URLSearchParams();

        if (filters.genres && filters.genres.length > 0) {
            params.set('genres', filters.genres.join(','));
        }
        if (filters.minRating !== undefined) {
            params.set('minRating', String(filters.minRating));
        }
        if (filters.maxRating !== undefined) {
            params.set('maxRating', String(filters.maxRating));
        }
        if (filters.dateFrom) {
            params.set('dateFrom', filters.dateFrom);
        }
        if (filters.dateTo) {
            params.set('dateTo', filters.dateTo);
        }
        if (filters.sort) {
            params.set('sort', filters.sort);
        }
        if (filters.sortOrder) {
            params.set('sortOrder', filters.sortOrder);
        }
        if (filters.excludeIds && filters.excludeIds.length > 0) {
            params.set('excludeIds', filters.excludeIds.join(','));
        }
        if (filters.page !== undefined) {
            params.set('page', String(filters.page));
        }
        if (filters.limit !== undefined) {
            params.set('limit', String(filters.limit));
        }

        const queryString = params.toString();
        return edgeFetch(`/games-browse${queryString ? `?${queryString}` : ''}`);
    },
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

export const discoveryApi = {
    getPersonalized: (
        mode: 'standard' | 'contrarian' = 'standard',
        limit = 10
    ): Promise<{ mode: string; results: DiscoveryRecommendation[] }> =>
        edgeFetchAuthenticated(`/discovery-personalized?mode=${mode}&limit=${limit}`),
};

export const socialApi = {
    getCompatibility: (limit = 8): Promise<{ results: CompatibilityPreview[] }> =>
        edgeFetchAuthenticated(`/compatibility-preview?limit=${limit}`),

    circleAction: (
        payload:
            | { action: 'create_circle'; name: string; description?: string; visibility?: 'private' | 'friends' }
            | { action: 'join_circle'; circleId: string }
            | { action: 'create_challenge'; circleId: string; title: string; goalType: 'finish_count' | 'session_minutes'; goalTarget: number; startDate: string; endDate: string }
            | { action: 'update_progress'; challengeId: string; progressDelta: number }
            | { action: 'list_my_circles' }
    ): Promise<{ result?: SocialCircle; results?: SocialCircle[]; ok?: boolean }> =>
        edgeFetchAuthenticated('/circle-challenges', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
};

export const feedApi = {
    rank: (
        events: Array<{ id: string; actorId: string; type: string; createdAt: string; metadata?: Record<string, unknown> }>,
        limit = 10
    ): Promise<{ results: RankedFeedEvent[] }> =>
        edgeFetchAuthenticated('/feed-rank', {
            method: 'POST',
            body: JSON.stringify({ events, limit }),
        }),
};
