import type { GameSearchResult, Review } from '../src/domain/types';
import {
    buildDiscoveryExplanationPayload,
    buildExplanation,
    buildPreferenceVector,
    classifyDiscoveryRisk,
    computeDiscoveryConfidence,
    recommend,
    scoreActivityForFeed,
    scoreCandidate,
} from '../src/lib/recommender';

const mockGame = (overrides: Partial<GameSearchResult> = {}): GameSearchResult => ({
    providerId: '1',
    provider: 'igdb',
    title: 'Hades',
    genres: ['Roguelike', 'Action'],
    platforms: ['PC', 'Switch'],
    rating: 90,
    ...overrides,
});

const mockReview = (overrides: Partial<Review & { game?: GameSearchResult }> = {}) => ({
    id: 'r1',
    userId: 'u1',
    gameId: 'g1',
    rating: 5,
    spoiler: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    game: mockGame(),
    ...overrides,
});

describe('buildPreferenceVector', () => {
    it('accumulates genre weights from reviews', () => {
        const reviews = [mockReview({ rating: 4 })];
        const vector = buildPreferenceVector(reviews as any, []);
        expect(vector.genres['Roguelike']).toBeGreaterThan(0);
        expect(vector.genres['Action']).toBeGreaterThan(0);
        expect(vector.avgRating).toBe(4);
        expect(vector.totalRated).toBe(1);
    });

    it('gives higher weight to higher-rated games', () => {
        const reviews = [
            mockReview({ rating: 5, game: mockGame({ genres: ['Roguelike'] }) }),
            mockReview({ rating: 1, gameId: 'g2', game: mockGame({ providerId: '2', genres: ['Sports'] }) }),
        ];
        const vector = buildPreferenceVector(reviews as any, []);
        // Roguelike (5★) should have 5× weight of Sports (1★)
        expect(vector.genres['Roguelike']).toBeGreaterThan(vector.genres['Sports']);
    });

    it('returns empty vector with no history', () => {
        const vector = buildPreferenceVector([], []);
        expect(vector.totalRated).toBe(0);
        expect(Object.keys(vector.genres)).toHaveLength(0);
    });
});

describe('scoreCandidate', () => {
    it('scores a matching game higher than a non-matching game', () => {
        const vector = buildPreferenceVector([mockReview({ rating: 5 })] as any, []);
        const matching = mockGame({ genres: ['Roguelike', 'Action'], rating: 90 });
        const nonMatching = mockGame({ genres: ['Sports', 'Simulation'], rating: 50, providerId: '99' });

        expect(scoreCandidate(matching, vector)).toBeGreaterThan(scoreCandidate(nonMatching, vector));
    });
});

describe('buildExplanation', () => {
    it('builds a non-empty explanation', () => {
        const vector = buildPreferenceVector([mockReview({ rating: 5 })] as any, []);
        const game = mockGame({ genres: ['Roguelike'], rating: 90 });
        const explanation = buildExplanation(game, vector);
        expect(explanation.length).toBeGreaterThan(0);
        expect(explanation).toMatch(/Roguelike|rated|history/i);
    });
});

describe('recommend', () => {
    it('returns top N recommendations', () => {
        const reviews = [mockReview({ rating: 5 })];
        const candidates = [
            mockGame({ providerId: '10', genres: ['Roguelike'], rating: 85 }),
            mockGame({ providerId: '11', genres: ['Sports'], rating: 50 }),
            mockGame({ providerId: '12', genres: ['Roguelike', 'Action'], rating: 90 }),
        ];
        const recs = recommend(candidates, reviews as any, [], 2);
        expect(recs).toHaveLength(2);
        // Top rec should be the one with most genre overlap + high rating
        expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score);
    });

    it('returns empty array with no user history', () => {
        const candidates = [mockGame()];
        const recs = recommend(candidates, [], [], 5);
        expect(recs).toHaveLength(0);
    });
});

describe('discovery explainability primitives', () => {
    it('classifies low-rated candidate as higher risk', () => {
        expect(classifyDiscoveryRisk({ rating: 58 } as GameSearchResult, 0.65)).toBe('high');
        expect(classifyDiscoveryRisk({ rating: 89 } as GameSearchResult, 0.8)).toBe('low');
    });

    it('computes confidence from overlap and history', () => {
        const confidenceSparse = computeDiscoveryConfidence({
            overlapScore: 0.2,
            totalRated: 1,
            feedbackSamples: 0,
        });
        const confidenceRich = computeDiscoveryConfidence({
            overlapScore: 0.8,
            totalRated: 20,
            feedbackSamples: 12,
        });

        expect(confidenceRich).toBeGreaterThan(confidenceSparse);
    });

    it('builds explanation payload with reason, confidence, and risk', () => {
        const vector = buildPreferenceVector([mockReview({ rating: 5 })] as any, []);
        const game = mockGame({ rating: 86 });
        const payload = buildDiscoveryExplanationPayload(game, vector, {
            overlapScore: 0.72,
            feedbackSamples: 4,
        });

        expect(payload.reason).toMatch(/Because|Based/i);
        expect(payload.confidence).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(payload.risk);
    });
});

describe('activity feed scoring', () => {
    it('prioritizes events with stronger social overlap and freshness', () => {
        const now = Date.now();
        const highEventScore = scoreActivityForFeed({
            createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
            compatibilityScore: 0.82,
            challengeRelevance: 0.7,
        });
        const lowEventScore = scoreActivityForFeed({
            createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            compatibilityScore: 0.12,
            challengeRelevance: 0.1,
        });

        expect(highEventScore.score).toBeGreaterThan(lowEventScore.score);
        expect(highEventScore.reasonChips.length).toBeGreaterThan(0);
    });
});
