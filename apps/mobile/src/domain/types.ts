// Domain types - pure TypeScript, no framework dependencies

export type GameStatus = 'played' | 'playing' | 'backlog' | 'wishlist';
export type Platform = 'PS5' | 'Xbox' | 'Switch' | 'PC' | 'PS4' | 'iOS' | 'Android' | 'Other';
export type SearchMatchType = 'title' | 'company' | 'character';

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
    rating?: number;      // 0-100 scale from IGDB, normalized to 0-5 in UI
    matchType?: SearchMatchType;
    matchLabel?: string;
}

// ---- Company Credits ----
export interface InvolvedCompany {
    company: { id?: number; name: string };
    developer: boolean;
    publisher: boolean;
    porting: boolean;
}

export interface CharacterCredit {
    id: number;
    name: string;
    imageUrl?: string;
}

export interface GameDetail extends GameSearchResult {
    description?: string;
    themes?: string[];
    similarGameIds?: string[];
    metacritic?: number;
    involvedCompanies?: InvolvedCompany[];
    characterCredits?: CharacterCredit[];
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
    rating: number; // 0.5-5.0
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
    firstTimePlay?: boolean;
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

// ---- Browse Filters ----
export interface BrowseFilters {
    genres?: number[];      // IGDB genre IDs
    minRating?: number;     // 0-100
    maxRating?: number;     // 0-100
    dateFrom?: string;      // ISO date string
    dateTo?: string;        // ISO date string
    sort?: 'rating' | 'first_release_date' | 'hypes';
    sortOrder?: 'asc' | 'desc';
    excludeIds?: string[];  // Game provider IDs to exclude
    page?: number;
    limit?: number;
}

// IGDB Genre ID mapping (genre name -> IGDB ID)
export const IGDB_GENRE_IDS: Record<string, number> = {
    'Action': 4,
    'Adventure': 31,
    'RPG': 12,
    'Shooter': 5,
    'Indie': 32,
    'Strategy': 15,
    'Puzzle': 9,
    'Racing': 10,
    'Sports': 14,
    'Simulation': 13,
    'Fighting': 6,
    'Platformer': 8,
    'Horror': 19,
    'Music': 7,
    'Turn-based': 16,
    'Visual Novel': 34,
    'Arcade': 33,
    'MOBA': 11,
    'Point-and-Click': 2,
    'Tactical': 24,
    'Hack and Slash': 25,
    'Quiz/Trivia': 26,
    'Pinball': 30,
};

// Available genres for filter UI (with IGDB IDs)
export const AVAILABLE_GENRES = [
    { id: 4, name: 'Action' },
    { id: 31, name: 'Adventure' },
    { id: 12, name: 'RPG' },
    { id: 5, name: 'Shooter' },
    { id: 32, name: 'Indie' },
    { id: 15, name: 'Strategy' },
    { id: 9, name: 'Puzzle' },
    { id: 10, name: 'Racing' },
    { id: 14, name: 'Sports' },
    { id: 13, name: 'Simulation' },
    { id: 6, name: 'Fighting' },
    { id: 8, name: 'Platformer' },
    { id: 19, name: 'Horror' },
    { id: 34, name: 'Visual Novel' },
    { id: 33, name: 'Arcade' },
];
