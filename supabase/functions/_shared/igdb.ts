// IGDB token cache — shared across Edge Function invocations in the same process
// Handles Twitch OAuth app-access token lifecycle
// v2 — validates cached token matches current client ID

interface TokenCache {
    accessToken: string;
    expiresAt: number; // unix ms
    clientId: string;  // busts cache if credentials change
}

let cache: TokenCache | null = null;

export async function getIgdbToken(): Promise<string> {
    const now = Date.now();
    const clientId = Deno.env.get('IGDB_CLIENT_ID');
    const clientSecret = Deno.env.get('IGDB_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
        throw new Error('IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in Edge Function env');
    }

    // Bust cache if credentials changed or token expired
    if (cache && cache.expiresAt > now + 60_000 && cache.clientId === clientId) {
        return cache.accessToken;
    }

    const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
        { method: 'POST' }
    );

    if (!res.ok) {
        throw new Error(`Twitch token fetch failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    cache = {
        accessToken: json.access_token,
        expiresAt: now + json.expires_in * 1000,
        clientId,
    };
    return cache.accessToken;
}

export async function igdbFetch(endpoint: string, body: string): Promise<any> {
    const clientId = Deno.env.get('IGDB_CLIENT_ID')!;
    const accessToken = await getIgdbToken();

    const res = await fetch(`https://api.igdb.com/v4${endpoint}`, {
        method: 'POST',
        headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body,
    });

    if (!res.ok) {
        throw new Error(`IGDB ${endpoint} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
}

// ---- Data mapping ----
function coverUrl(coverId: number | undefined, imageId?: string): string | undefined {
    if (!imageId) return undefined;
    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

export function mapGame(g: any) {
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
        themes: (g.themes ?? []).map((x: any) => x.name),
        description: g.summary,
        rating: g.rating ? Math.round(g.rating * 10) / 10 : undefined,
        similarGameIds: (g.similar_games ?? []).map((x: any) => String(x)),
    };
}
