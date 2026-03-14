import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCard, GameHeroCard } from '../../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { ActivityEvent, ActivityType, GameSearchResult, RankedFeedEvent } from '../../../src/domain/types';
import { IGDB_GENRE_IDS } from '../../../src/domain/types';
import { discoveryApi, feedApi, gamesApi } from '../../../src/lib/api';
import { isFeatureEnabled } from '../../../src/lib/featureFlags';
import { buildPreferenceVector, recommend } from '../../../src/lib/recommender';
import { supabase } from '../../../src/lib/supabase';
import { trackDiscoveryFeedback } from '../../../src/lib/telemetry';
import { withTimeout } from '../../../src/lib/withTimeout';
import { useAuthStore } from '../../../src/stores/authStore';
import { useAppTheme } from '../../../src/theme/appTheme';

function SectionHeader({ icon, title, subtitle, accent }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; accent: string }) {
    const { theme } = useAppTheme();
    return (
        <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${accent}18`, borderColor: `${accent}35` }]}>
                <Ionicons name={icon} size={16} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>{title}</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>{subtitle}</Text>
            </View>
        </View>
    );
}

function ActivityTile({ event }: { event: ActivityEvent | RankedFeedEvent }) {
    const { theme } = useAppTheme();
    const meta = event.metadata as Record<string, any>;
    const actorName = event.actor?.displayName || 'Someone';

    const iconByType: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
        review: 'create',
        rating: 'star',
        status_change: 'game-controller',
        list_add: 'list',
        follow: 'people',
        challenge: 'trophy',
    };

    const accentByType: Record<ActivityType, string> = {
        review: theme.colors.hero.tertiary,
        rating: theme.colors.star,
        status_change: theme.colors.hero.primary,
        list_add: theme.colors.hero.quaternary,
        follow: theme.colors.hero.secondary,
        challenge: theme.colors.neon.orange,
    };

    const labelByType = () => {
        const gameTitle = meta?.game_title || 'a game';
        switch (event.type) {
            case 'review': return `${actorName} reviewed ${gameTitle}`;
            case 'rating': return `${actorName} rated ${gameTitle}`;
            case 'status_change': return `${actorName} marked ${gameTitle} as ${meta?.status || 'played'}`;
            case 'list_add': return `${actorName} added ${gameTitle} to a list`;
            case 'follow': return `${actorName} followed someone`;
            case 'challenge': return `${actorName} made challenge progress`;
        }
    };

    return (
        <View style={[styles.activityTile, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
            <View style={[styles.activityBadge, { backgroundColor: `${accentByType[event.type]}18` }]}>
                <Ionicons name={iconByType[event.type]} size={16} color={accentByType[event.type]} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.activityText, { color: theme.colors.text.primary }]}>{labelByType()}</Text>
                {'reasonChips' in event && event.reasonChips?.length > 0 && (
                    <View style={styles.reasonChipRow}>
                        {event.reasonChips.slice(0, 2).map((chip) => (
                            <View key={`${event.id}-${chip}`} style={[styles.reasonChip, { borderColor: theme.colors.border }]}>
                                <Text style={[styles.reasonChipText, { color: theme.colors.text.secondary }]}>{chip}</Text>
                            </View>
                        ))}
                    </View>
                )}
                <Text style={[styles.activityMeta, { color: theme.colors.text.secondary }]}>
                    {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
            </View>
        </View>
    );
}

export default function DiscoverScreen() {
    const { user } = useAuthStore();
    const router = useRouter();
    const { theme } = useAppTheme();
    const [mode, setMode] = useState<'standard' | 'contrarian'>('standard');
    const dayKey = new Date().toISOString().slice(0, 10);

    const { data: personalizedEnabled = false } = useQuery({
        queryKey: ['feature-flag-discovery-personalized', user?.id],
        queryFn: () => isFeatureEnabled('discovery_personalized', user?.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    const { data: feedRankerEnabled = false } = useQuery({
        queryKey: ['feature-flag-feed-ranker', user?.id],
        queryFn: () => isFeatureEnabled('feed_ranker', user?.id),
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });

    const { data: trending = [] } = useQuery<GameSearchResult[]>({
        queryKey: ['trending-games', dayKey],
        queryFn: async () => {
            const hypes = await gamesApi.browse({ sort: 'hypes', sortOrder: 'desc', limit: 24 }).catch(() => ({ results: [] as GameSearchResult[] }));
            if (hypes.results.length > 0) return hypes.results;
            const byRating = await gamesApi.browse({ sort: 'rating', sortOrder: 'desc', limit: 24 }).catch(() => ({ results: [] as GameSearchResult[] }));
            return byRating.results;
        },
        staleTime: 1000 * 60 * 60 * 6,
    });

    const { data: rawFeed = [] } = useQuery<ActivityEvent[]>({
        queryKey: ['activity-feed-raw', user?.id],
        queryFn: async () => {
            if (!user) return [];
            try {
                const { data, error } = await withTimeout(
                    supabase
                        .from('activity_events')
                        .select('*, actor:profiles(id, display_name, avatar_url)')
                        .order('created_at', { ascending: false })
                        .limit(8),
                    8_000,
                    'Load activity'
                );
                if (error) return [];
                return (data ?? []).map((event: any) => ({
                    id: event.id,
                    actorId: event.actor_id,
                    type: event.type,
                    entityId: event.entity_id,
                    metadata: event.metadata,
                    createdAt: event.created_at,
                    actor: event.actor ? {
                        id: event.actor.id,
                        displayName: event.actor.display_name,
                        avatarUrl: event.actor.avatar_url,
                    } : undefined,
                }));
            } catch {
                return [];
            }
        },
        enabled: !!user,
        staleTime: 1000 * 30,
    });

    const { data: feed = [] } = useQuery<Array<ActivityEvent | RankedFeedEvent>>({
        queryKey: ['activity-feed-ranked', user?.id, rawFeed.length, feedRankerEnabled],
        queryFn: async () => {
            if (!user || rawFeed.length === 0 || !feedRankerEnabled) return rawFeed;
            try {
                const { results } = await feedApi.rank(
                    rawFeed.map((event) => ({
                        id: event.id,
                        actorId: event.actorId,
                        type: event.type,
                        createdAt: event.createdAt,
                        metadata: event.metadata,
                    })),
                    8
                );
                const byId = new Map(rawFeed.map((event) => [event.id, event]));
                return results.map((ranked) => ({
                    ...(byId.get(ranked.id) ?? ranked),
                    score: ranked.score,
                    reasonChips: ranked.reasonChips,
                }));
            } catch {
                return rawFeed;
            }
        },
        enabled: !!user,
        staleTime: 1000 * 30,
    });

    const { data: recommendations = [] } = useQuery({
        queryKey: ['discover-recommendations', user?.id, mode, personalizedEnabled],
        queryFn: async () => {
            if (!user) return [];
            const loadLegacyRecommendations = async () => {
                const [
                    { data: reviews, error: reviewsError },
                    { data: statuses, error: statusesError },
                ] = await Promise.all([
                    supabase.from('reviews').select('*, game:games(*)').eq('user_id', user.id),
                    supabase.from('user_game_status').select('*, game:games(*)').eq('user_id', user.id),
                ]);
                if (reviewsError || statusesError) {
                    throw reviewsError ?? statusesError;
                }

                const mappedReviews = (reviews ?? []).map((review: any) => ({
                    id: review.id,
                    userId: review.user_id,
                    gameId: review.game_id,
                    rating: Number(review.rating),
                    reviewText: review.review_text,
                    spoiler: review.spoiler,
                    createdAt: review.created_at,
                    updatedAt: review.updated_at,
                    game: review.game ? {
                        providerId: review.game.provider_game_id,
                        provider: 'igdb' as const,
                        title: review.game.title,
                        genres: review.game.genres ?? [],
                        platforms: review.game.platforms ?? [],
                        rating: review.game.rating,
                    } : undefined,
                }));

                const mappedStatuses = (statuses ?? []).map((status: any) => ({
                    userId: status.user_id,
                    gameId: status.game_id,
                    status: status.status,
                    addedAt: status.added_at,
                    lastUpdated: status.last_updated,
                    game: status.game ? {
                        providerId: status.game.provider_game_id,
                        provider: 'igdb' as const,
                        title: status.game.title,
                        genres: status.game.genres ?? [],
                        platforms: status.game.platforms ?? [],
                        rating: status.game.rating,
                    } : undefined,
                }));

                if (mappedReviews.length === 0 && mappedStatuses.length === 0) return [];

                const vector = buildPreferenceVector(mappedReviews as any, mappedStatuses as any);
                const topGenreIds = Object.entries(vector.genres)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([name]) => IGDB_GENRE_IDS[name])
                    .filter((id): id is number => id !== undefined);

                if (topGenreIds.length === 0) return [];

                const playedProviderIds = new Set([
                    ...mappedReviews.filter((review) => review.game?.providerId).map((review) => review.game!.providerId),
                    ...mappedStatuses.filter((status) => status.game?.providerId).map((status) => status.game!.providerId),
                ]);

                const { results: candidates } = await gamesApi.browse({
                    genres: topGenreIds,
                    minRating: 72,
                    sort: 'rating',
                    sortOrder: 'desc',
                    excludeIds: Array.from(playedProviderIds),
                    limit: 20,
                });

                return recommend(candidates, mappedReviews as any, mappedStatuses as any, 4).map((result) => ({
                    ...result.game,
                    matchLabel: result.reason,
                    source: 'legacy' as const,
                }));
            };

            if (personalizedEnabled) {
                try {
                    const { results } = await discoveryApi.getPersonalized(mode, 6);
                    if (results.length > 0) {
                        return results.map((result) => ({
                            providerId: result.providerId,
                            provider: 'igdb' as const,
                            title: result.title,
                            coverUrl: result.coverUrl,
                            releaseDate: result.releaseDate,
                            genres: result.genres,
                            platforms: result.platforms,
                            rating: result.rating,
                            matchLabel: `${result.reason} • ${(result.confidence * 100).toFixed(0)}% confidence • ${result.risk} risk`,
                            confidence: result.confidence,
                            risk: result.risk,
                            source: 'personalized' as const,
                        }));
                    }
                    if (mode === 'contrarian') {
                        // Keep contrarian distinct. Do not fall back to standard list.
                        return [];
                    }
                } catch {
                    if (mode === 'contrarian') {
                        return [];
                    }
                    // Fall through to legacy recommendations for standard mode.
                }
            }

            return loadLegacyRecommendations();
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 10,
    });

    const featured = (() => {
        if (trending.length === 0) return undefined;
        const daysFromEpoch = Math.floor(new Date(`${dayKey}T00:00:00Z`).getTime() / 86_400_000);
        return trending[daysFromEpoch % trending.length];
    })();
    const shelf = trending.filter((g) => g.providerId !== featured?.providerId).slice(0, 8);
    const heroAccent = theme.colors.hero.primary;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <View>
                            <Text style={[styles.headline, { color: theme.colors.text.primary }]}>Discover</Text>
                        </View>
                        <ThemeModeToggle compact />
                    </View>

                    {featured && (
                        <TouchableOpacity activeOpacity={0.94} onPress={() => router.push(`/game/${featured.providerId}`)}>
                            <LinearGradient
                                colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.heroPanel}
                            >
                                <Text style={styles.heroLabel}>Featured Today</Text>
                                <Text style={styles.heroTitle}>{featured.title}</Text>
                                <Text style={styles.heroBlurb}>
                                    Jump into a standout pick from the current catalog and inspect its details, cast, and community context.
                                </Text>
                                <View style={styles.heroMetaRow}>
                                    <View style={styles.heroMetaPill}>
                                        <Ionicons name="sparkles" size={12} color={theme.colors.white} />
                                        <Text style={styles.heroMetaText}>Trending</Text>
                                    </View>
                                    {featured.releaseDate && (
                                        <View style={styles.heroMetaPill}>
                                            <Ionicons name="calendar-outline" size={12} color={theme.colors.white} />
                                            <Text style={styles.heroMetaText}>{new Date(featured.releaseDate).getFullYear()}</Text>
                                        </View>
                                    )}
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <SectionHeader
                        icon="flame"
                        title="Trending Shelf"
                        subtitle="Fresh daily picks from live IGDB trending data"
                        accent={heroAccent}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroCarousel}>
                        {shelf.map((game) => (
                            <GameHeroCard key={game.providerId} game={game} onPress={() => router.push(`/game/${game.providerId}`)} />
                        ))}
                    </ScrollView>

                    <SectionHeader
                        icon="sparkles"
                        title={mode === 'contrarian' ? 'Contrarian Discovery' : 'Made For Your Taste'}
                        subtitle={personalizedEnabled
                            ? 'Explainable picks with confidence and risk signals'
                            : 'Recommendations weighted from your ratings and status history'}
                        accent={theme.colors.hero.secondary}
                    />
                    {personalizedEnabled && (
                        <View style={styles.modeToggleRow}>
                            <TouchableOpacity
                                onPress={() => setMode('standard')}
                                style={[
                                    styles.modeToggle,
                                    {
                                        borderColor: theme.colors.border,
                                        backgroundColor: mode === 'standard' ? theme.colors.surface.glassStrong : 'transparent',
                                    },
                                ]}
                            >
                                <Text style={[styles.modeToggleText, { color: theme.colors.text.primary }]}>Standard</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMode('contrarian')}
                                style={[
                                    styles.modeToggle,
                                    {
                                        borderColor: theme.colors.border,
                                        backgroundColor: mode === 'contrarian' ? theme.colors.surface.glassStrong : 'transparent',
                                    },
                                ]}
                            >
                                <Text style={[styles.modeToggleText, { color: theme.colors.text.primary }]}>Contrarian</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {recommendations.length > 0 ? (
                        <View style={styles.stack}>
                            {recommendations.map((recommendation: any) => {
                                const providerId = recommendation.providerId;
                                return (
                                    <View key={providerId} style={styles.recommendationCardStack}>
                                        <GameCard
                                            game={recommendation}
                                            onPress={() => {
                                                if (user) {
                                                    void trackDiscoveryFeedback({
                                                        userId: user.id,
                                                        providerGameId: providerId,
                                                        feedbackType: 'open',
                                                        source: 'discover',
                                                    });
                                                }
                                                router.push(`/game/${providerId}`);
                                            }}
                                        />
                                        {recommendation.source === 'personalized' && (
                                            <View style={styles.feedbackRow}>
                                                <TouchableOpacity
                                                    onPress={() => user && trackDiscoveryFeedback({
                                                        userId: user.id,
                                                        providerGameId: providerId,
                                                        feedbackType: 'save',
                                                        source: 'discover',
                                                    })}
                                                    style={[styles.feedbackButton, { borderColor: theme.colors.border }]}
                                                >
                                                    <Ionicons name="bookmark-outline" size={14} color={theme.colors.text.secondary} />
                                                    <Text style={[styles.feedbackText, { color: theme.colors.text.secondary }]}>Useful</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => user && trackDiscoveryFeedback({
                                                        userId: user.id,
                                                        providerGameId: providerId,
                                                        feedbackType: 'skip',
                                                        source: 'discover',
                                                    })}
                                                    style={[styles.feedbackButton, { borderColor: theme.colors.border }]}
                                                >
                                                    <Ionicons name="play-skip-forward-outline" size={14} color={theme.colors.text.secondary} />
                                                    <Text style={[styles.feedbackText, { color: theme.colors.text.secondary }]}>Skip</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <Ionicons name="sparkles-outline" size={28} color={theme.colors.text.muted} />
                            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                                {mode === 'contrarian' ? 'No contrarian picks right now' : 'No recommendations yet'}
                            </Text>
                            <Text style={[styles.emptyCopy, { color: theme.colors.text.secondary }]}>
                                {mode === 'contrarian'
                                    ? 'Try switching back to Standard or check again later for more adventurous picks.'
                                    : 'Rate or log a few games, then reopen Discover. Recommendations will populate from your taste profile.'}
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => router.push('/circles' as any)}
                        style={[styles.circlesBanner, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}
                    >
                        <View style={styles.circlesTextWrap}>
                            <Text style={[styles.circlesTitle, { color: theme.colors.text.primary }]}>Backlog Parties</Text>
                            <Text style={[styles.circlesSubtitle, { color: theme.colors.text.secondary }]}>
                                Create social circles and challenge your friends to finally finish games.
                            </Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color={theme.colors.hero.secondary} />
                    </TouchableOpacity>

                    <SectionHeader
                        icon="people"
                        title="Friend Activity"
                        subtitle="A live pulse of reviews, ratings, and status changes"
                        accent={theme.colors.hero.quaternary}
                    />
                    <View style={styles.stack}>
                        {feed.length === 0 ? (
                            <View style={[styles.emptyState, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                                <Ionicons name="people-outline" size={28} color={theme.colors.text.muted} />
                                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No activity yet</Text>
                                <Text style={[styles.emptyCopy, { color: theme.colors.text.secondary }]}>
                                    Once you and your friends start logging games, the feed will animate with ratings and reviews here.
                                </Text>
                            </View>
                        ) : (
                            feed.map((event) => <ActivityTile key={event.id} event={event} />)
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 120,
        gap: 18,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headline: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.3,
    },
    heroPanel: {
        borderRadius: 30,
        padding: 24,
        marginBottom: 20,
    },
    heroLabel: {
        color: '#ffffff',
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    heroTitle: {
        color: '#ffffff',
        fontSize: 30,
        lineHeight: 34,
        fontFamily: 'Inter_700Bold',
        maxWidth: 280,
    },
    heroBlurb: {
        marginTop: 10,
        color: 'rgba(255,255,255,0.82)',
        fontSize: 14,
        lineHeight: 21,
        fontFamily: 'Inter_400Regular',
        maxWidth: 320,
    },
    heroMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 18,
    },
    heroMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroMetaText: {
        color: '#ffffff',
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    sectionIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 19,
        fontFamily: 'Inter_700Bold',
    },
    sectionSubtitle: {
        marginTop: 2,
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    heroCarousel: {
        gap: 14,
        paddingBottom: 8,
        marginBottom: 12,
    },
    stack: {
        gap: 12,
        marginBottom: 12,
    },
    recommendationCardStack: {
        gap: 8,
    },
    modeToggleRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    modeToggle: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    modeToggleText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    feedbackRow: {
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 8,
    },
    feedbackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    feedbackText: {
        fontSize: 11,
        fontFamily: 'Inter_500Medium',
    },
    activityTile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 24,
        borderWidth: 1,
        padding: 16,
    },
    activityBadge: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityText: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'Inter_500Medium',
    },
    activityMeta: {
        marginTop: 4,
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    reasonChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    reasonChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    reasonChipText: {
        fontSize: 10,
        fontFamily: 'Inter_500Medium',
    },
    circlesBanner: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    circlesTextWrap: {
        flex: 1,
    },
    circlesTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
    circlesSubtitle: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Inter_400Regular',
    },
    emptyState: {
        borderRadius: 26,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    emptyCopy: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
    },
});
