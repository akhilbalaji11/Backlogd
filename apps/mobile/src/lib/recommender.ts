// Content-based game recommender
// Layer 1: entirely deterministic, no paid API needed

import type { GameSearchResult, Recommendation, Review, UserGameStatus } from '../domain/types';

interface UserPreferenceVector {
    genres: Record<string, number>;
    platforms: Record<string, number>;
    themes: Record<string, number>;
    avgRating: number;
    totalRated: number;
}

export type DiscoveryRisk = 'low' | 'medium' | 'high';

interface DiscoveryConfidenceInput {
    overlapScore: number;
    totalRated: number;
    feedbackSamples: number;
}

interface ActivityScoreInput {
    createdAt: string;
    compatibilityScore?: number;
    challengeRelevance?: number;
}

interface ActivityScoreOutput {
    score: number;
    reasonChips: string[];
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Build a weighted preference vector from the user's reviews and statuses.
 * Games rated higher contribute more weight.
 */
export function buildPreferenceVector(
    reviews: Array<Review & { game?: GameSearchResult }>,
    statuses: Array<UserGameStatus & { game?: GameSearchResult }>
): UserPreferenceVector {
    const genres: Record<string, number> = {};
    const platforms: Record<string, number> = {};
    const themes: Record<string, number> = {};
    let ratingSum = 0;
    let totalRated = 0;

    // Reviewed games get weight = rating / 5 (so 5★ = full weight)
    for (const rev of reviews) {
        const weight = rev.rating / 5;
        ratingSum += rev.rating;
        totalRated++;

        for (const g of rev.game?.genres ?? []) {
            genres[g] = (genres[g] ?? 0) + weight;
        }
        for (const p of rev.game?.platforms ?? []) {
            platforms[p] = (platforms[p] ?? 0) + weight;
        }
        // themes is a GameDetail field, may be missing in GameSearchResult
        const gameWithThemes = rev.game as any;
        for (const t of gameWithThemes?.themes ?? []) {
            themes[t] = (themes[t] ?? 0) + weight;
        }
    }

    // Played / playing games get weight = 0.6 (liked, but no rating signal)
    for (const s of statuses.filter((x) => x.status === 'played' || x.status === 'playing')) {
        const weight = 0.6;
        for (const g of s.game?.genres ?? []) {
            genres[g] = (genres[g] ?? 0) + weight;
        }
        for (const p of s.game?.platforms ?? []) {
            platforms[p] = (platforms[p] ?? 0) + weight;
        }
    }

    return {
        genres,
        platforms,
        themes,
        avgRating: totalRated > 0 ? ratingSum / totalRated : 3.0,
        totalRated,
    };
}

/**
 * Score a candidate game against the preference vector.
 * Returns a 0–1 similarity score.
 */
export function scoreCandidate(
    game: GameSearchResult,
    vector: UserPreferenceVector
): number {
    let score = 0;
    let maxPossible = 0;

    const allGenreWeight = Object.values(vector.genres).reduce((a, b) => a + b, 0) || 1;
    const allPlatformWeight = Object.values(vector.platforms).reduce((a, b) => a + b, 0) || 1;

    for (const g of game.genres) {
        score += (vector.genres[g] ?? 0) / allGenreWeight;
    }
    maxPossible += 1;

    for (const p of game.platforms) {
        score += (vector.platforms[p] ?? 0) / allPlatformWeight;
    }
    maxPossible += 1;

    // Community rating bonus (IGDB 0–100, normalize to 0–1)
    if (game.rating) {
        score += game.rating / 100;
    }
    maxPossible += 1;

    return maxPossible > 0 ? score / maxPossible : 0;
}

/**
 * Build a human-readable explanation for why a game is recommended.
 */
export function buildExplanation(
    game: GameSearchResult,
    vector: UserPreferenceVector
): string {
    const topGenre = Object.entries(vector.genres)
        .sort((a, b) => b[1] - a[1])
        .find(([g]) => game.genres.includes(g));

    const topPlatform = Object.entries(vector.platforms)
        .sort((a, b) => b[1] - a[1])
        .find(([p]) => game.platforms.includes(p));

    const parts: string[] = [];

    if (topGenre) {
        parts.push(`you love ${topGenre[0]} games`);
    }
    if (topPlatform && parts.length < 2) {
        parts.push(`it's on ${topPlatform[0]}`);
    }
    if (game.rating && game.rating > 80) {
        parts.push(`it's highly rated (${(game.rating / 20).toFixed(1)}★)`);
    }

    if (parts.length === 0) return 'Based on your gaming history';
    return `Because ${parts.join(' and ')}`;
}

export function computeDiscoveryConfidence(input: DiscoveryConfidenceInput): number {
    const overlapWeight = clamp(input.overlapScore, 0, 1) * 0.55;
    const historyWeight = clamp(input.totalRated / 20, 0, 1) * 0.3;
    const feedbackWeight = clamp(input.feedbackSamples / 25, 0, 1) * 0.15;
    return clamp(overlapWeight + historyWeight + feedbackWeight, 0, 1);
}

export function classifyDiscoveryRisk(game: GameSearchResult, confidence: number): DiscoveryRisk {
    const rating = game.rating ?? 65;
    if (rating >= 82 && confidence >= 0.65) return 'low';
    if (rating <= 65 || confidence < 0.4) return 'high';
    return 'medium';
}

export function buildDiscoveryExplanationPayload(
    game: GameSearchResult,
    vector: UserPreferenceVector,
    options: { overlapScore: number; feedbackSamples: number }
): { reason: string; confidence: number; risk: DiscoveryRisk } {
    const confidence = computeDiscoveryConfidence({
        overlapScore: options.overlapScore,
        totalRated: vector.totalRated,
        feedbackSamples: options.feedbackSamples,
    });

    return {
        reason: buildExplanation(game, vector),
        confidence,
        risk: classifyDiscoveryRisk(game, confidence),
    };
}

export function scoreActivityForFeed(input: ActivityScoreInput): ActivityScoreOutput {
    const createdAtMs = new Date(input.createdAt).getTime();
    const ageHours = Number.isFinite(createdAtMs)
        ? Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60))
        : 48;

    const freshness = clamp(1 - ageHours / 48, 0, 1);
    const compatibility = clamp(input.compatibilityScore ?? 0.35, 0, 1);
    const challenge = clamp(input.challengeRelevance ?? 0, 0, 1);

    const score = freshness * 0.5 + compatibility * 0.35 + challenge * 0.15;
    const reasonChips: string[] = [];

    if (compatibility >= 0.65) reasonChips.push('High taste overlap');
    if (challenge >= 0.55) reasonChips.push('Challenge progress');
    if (freshness >= 0.7) reasonChips.push('Fresh activity');
    if (reasonChips.length === 0) reasonChips.push('Recent from your network');

    return { score, reasonChips };
}

/**
 * Main recommendation function.
 * candidates: pool of games NOT already in user's log
 * reviews/statuses: user's history
 */
export function recommend(
    candidates: GameSearchResult[],
    reviews: Array<Review & { game?: GameSearchResult }>,
    statuses: Array<UserGameStatus & { game?: GameSearchResult }>,
    topN = 5
): Recommendation[] {
    if (reviews.length === 0 && statuses.length === 0) return [];

    const vector = buildPreferenceVector(reviews, statuses);

    return candidates
        .map((game) => ({
            game,
            score: scoreCandidate(game, vector),
            reason: buildExplanation(game, vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
}
