// Domain types — pure TypeScript, no framework dependencies

export type GameStatus = 'played' | 'playing' | 'backlog' | 'wishlist';
export type Platform = 'PS5' | 'Xbox' | 'Switch' | 'PC' | 'PS4' | 'iOS' | 'Android' | 'Other';

// ---- Game Metadata ----
export interface GameSearchResult {
    id?: string;          // our internal UUID (undefined if not yet cached in DB)
    providerId: string;   // IGDB numeric ID as string
    provider: 'igdb';
    title: string;
    coverUrl?: string;
    releaseDate?: string;
    genres: string[];
    platforms: string[];
    rating?: number;      // 0–100 scale from IGDB, normalized to 0–5 in UI
}

export interface GameDetail extends GameSearchResult {
    description?: string;
    themes?: string[];
    similarGameIds?: string[];
    metacritic?: number;
}

// ---- User / Profile ----
export interface Profile {
    id: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    favoritePlatforms: Platform[];
    createdAt: string;
}

// ---- Status ----
export interface UserGameStatus {
    userId: string;
    gameId: string;
    status: GameStatus;
    addedAt: string;
    lastUpdated: string;
}

// ---- Reviews ----
export interface Review {
    id: string;
    userId: string;
    gameId: string;
    rating: number; // 0.5–5.0
    reviewText?: string;
    spoiler: boolean;
    createdAt: string;
    updatedAt: string;
    // joined
    profile?: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>;
    likeCount?: number;
    commentCount?: number;
    userHasLiked?: boolean;
}

export interface ReviewComment {
    id: string;
    reviewId: string;
    userId: string;
    commentText: string;
    createdAt: string;
    profile?: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>;
}

// ---- Play Sessions ----
export interface PlaySession {
    id: string;
    userId: string;
    gameId: string;
    playedOn: string; // ISO date
    minutes?: number;
    platform?: string;
    notes?: string;
    createdAt: string;
    // joined
    game?: Pick<GameSearchResult, 'title' | 'coverUrl'>;
}

// ---- Lists ----
export interface GameList {
    id: string;
    userId: string;
    title: string;
    description?: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
    itemCount?: number;
}

export interface ListItem {
    listId: string;
    gameId: string;
    position: number;
    note?: string;
    createdAt: string;
    game?: GameSearchResult;
}

// ---- Activity ----
export type ActivityType =
    | 'review'
    | 'rating'
    | 'status_change'
    | 'list_add'
    | 'follow';

export interface ActivityEvent {
    id: string;
    actorId: string;
    type: ActivityType;
    entityId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    actor?: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>;
}

// ---- Social ----
export interface Follow {
    followerId: string;
    followingId: string;
    createdAt: string;
}

// ---- Recommendations ----
export interface Recommendation {
    game: GameSearchResult;
    score: number;
    reason: string; // human-readable explanation
}
