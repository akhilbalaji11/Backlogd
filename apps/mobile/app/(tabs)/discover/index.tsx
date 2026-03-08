import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCard, GameHeroCard } from '../../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { ActivityEvent, ActivityType, GameSearchResult } from '../../../src/domain/types';
import { IGDB_GENRE_IDS } from '../../../src/domain/types';
import { gamesApi } from '../../../src/lib/api';
import { buildPreferenceVector, recommend } from '../../../src/lib/recommender';
import { supabase } from '../../../src/lib/supabase';
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

function ActivityTile({ event }: { event: ActivityEvent }) {
    const { theme } = useAppTheme();
    const meta = event.metadata as Record<string, any>;
    const actorName = event.actor?.displayName || 'Someone';

    const iconByType: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
        review: 'create',
        rating: 'star',
        status_change: 'game-controller',
        list_add: 'list',
        follow: 'people',
    };

    const accentByType: Record<ActivityType, string> = {
        review: theme.colors.hero.tertiary,
        rating: theme.colors.star,
        status_change: theme.colors.hero.primary,
        list_add: theme.colors.hero.quaternary,
        follow: theme.colors.hero.secondary,
    };

    const labelByType = () => {
        const gameTitle = meta?.game_title || 'a game';
        switch (event.type) {
            case 'review': return `${actorName} reviewed ${gameTitle}`;
            case 'rating': return `${actorName} rated ${gameTitle}`;
            case 'status_change': return `${actorName} marked ${gameTitle} as ${meta?.status || 'played'}`;
            case 'list_add': return `${actorName} added ${gameTitle} to a list`;
            case 'follow': return `${actorName} followed someone`;
        }
    };

    return (
        <View style={[styles.activityTile, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
            <View style={[styles.activityBadge, { backgroundColor: `${accentByType[event.type]}18` }]}>
                <Ionicons name={iconByType[event.type]} size={16} color={accentByType[event.type]} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.activityText, { color: theme.colors.text.primary }]}>{labelByType()}</Text>
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

    const { data: trending = [] } = useQuery<GameSearchResult[]>({
        queryKey: ['trending-games'],
        queryFn: async () => {
            const { results } = await gamesApi.search('zelda', 1).catch(() => ({ results: [] }));
            if (results.length > 0) return results.slice(0, 8);
            const browse = await gamesApi.browse({ sort: 'rating', sortOrder: 'desc', limit: 8 });
            return browse.results;
        },
        staleTime: 1000 * 60 * 30,
    });

    const { data: feed = [] } = useQuery<ActivityEvent[]>({
        queryKey: ['activity-feed', user?.id],
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

    const { data: recommendations = [] } = useQuery({
        queryKey: ['discover-recommendations', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const [{ data: reviews }, { data: statuses }] = await Promise.all([
                supabase.from('reviews').select('*, game:games(*)').eq('user_id', user.id),
                supabase.from('user_game_status').select('*, game:games(*)').eq('user_id', user.id),
            ]);

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

            return recommend(candidates, mappedReviews as any, mappedStatuses as any, 4);
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 10,
    });

    const featured = trending[0];
    const heroAccent = theme.colors.hero.primary;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <View>
                            <Text style={[styles.kicker, { color: theme.colors.neon.orange }]}>Player One</Text>
                            <Text style={[styles.headline, { color: theme.colors.text.primary }]}>Discover</Text>
                            <Text style={[styles.copy, { color: theme.colors.text.secondary }]}>
                                Curated shelves, social activity, and recommendation cards that feel closer to a launcher than a list.
                            </Text>
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
                                <Text style={styles.heroLabel}>Featured Tonight</Text>
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
                        subtitle="Fast, glossy picks from the live catalog"
                        accent={heroAccent}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroCarousel}>
                        {trending.map((game) => (
                            <GameHeroCard key={game.providerId} game={game} onPress={() => router.push(`/game/${game.providerId}`)} />
                        ))}
                    </ScrollView>

                    {recommendations.length > 0 && (
                        <>
                            <SectionHeader
                                icon="sparkles"
                                title="Made For Your Taste"
                                subtitle="Recommendations weighted from your ratings and status history"
                                accent={theme.colors.hero.secondary}
                            />
                            <View style={styles.stack}>
                                {recommendations.map((recommendation) => (
                                    <GameCard
                                        key={recommendation.game.providerId}
                                        game={{ ...recommendation.game, matchLabel: recommendation.reason }}
                                        onPress={() => router.push(`/game/${recommendation.game.providerId}`)}
                                    />
                                ))}
                            </View>
                        </>
                    )}

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
        marginBottom: 6,
    },
    kicker: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    headline: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.3,
    },
    copy: {
        marginTop: 8,
        maxWidth: 300,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
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
