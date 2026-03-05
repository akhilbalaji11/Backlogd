import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameCard } from '../../../src/components/game/GameCard';
import type { ActivityEvent } from '../../../src/domain/types';
import { gamesApi } from '../../../src/lib/api';
import { buildPreferenceVector, recommend } from '../../../src/lib/recommender';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, radius, spacing, typography } from '../../../src/styles/tokens';

export default function DiscoverScreen() {
    const { user } = useAuthStore();
    const router = useRouter();

    // Load activity feed
    const { data: feed = [], isLoading: feedLoading } = useQuery<ActivityEvent[]>({
        queryKey: ['activity-feed', user?.id],
        queryFn: async () => {
            if (!user) return [];
            try {
                const { data, error } = await supabase
                    .from('activity_events')
                    .select('*, actor:profiles(id, display_name, avatar_url)')
                    .order('created_at', { ascending: false })
                    .limit(30);
                if (error) {
                    console.warn('[Discover] activity feed error:', error.message);
                    return [];
                }
                return (data ?? []).map((e) => ({
                    id: e.id,
                    actorId: e.actor_id,
                    type: e.type,
                    entityId: e.entity_id,
                    metadata: e.metadata,
                    createdAt: e.created_at,
                    actor: e.actor ? {
                        id: e.actor.id,
                        displayName: e.actor.display_name,
                        avatarUrl: e.actor.avatar_url,
                    } : undefined,
                }));
            } catch (err: any) {
                console.warn('[Discover] activity feed exception:', err.message);
                return [];
            }
        },
        enabled: !!user,
        refetchInterval: 30_000,
    });


    // Load user's reviews + statuses for recommendations
    const { data: recommendations = [] } = useQuery({
        queryKey: ['recommendations', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const [{ data: reviews }, { data: statuses }] = await Promise.all([
                supabase.from('reviews').select('*, game:games(*)').eq('user_id', user.id),
                supabase.from('user_game_status').select('*, game:games(*)').eq('user_id', user.id),
            ]);

            const mappedReviews = (reviews ?? []).map((r) => ({
                id: r.id, userId: r.user_id, gameId: r.game_id,
                rating: Number(r.rating), reviewText: r.review_text,
                spoiler: r.spoiler, createdAt: r.created_at, updatedAt: r.updated_at,
                game: r.game ? { providerId: r.game.provider_game_id, provider: 'igdb' as const, title: r.game.title, genres: r.game.genres ?? [], platforms: r.game.platforms ?? [], rating: r.game.rating } : undefined,
            }));

            const mappedStatuses = (statuses ?? []).map((s) => ({
                userId: s.user_id, gameId: s.game_id, status: s.status,
                addedAt: s.added_at, lastUpdated: s.last_updated,
                game: s.game ? { providerId: s.game.provider_game_id, provider: 'igdb' as const, title: s.game.title, genres: s.game.genres ?? [], platforms: s.game.platforms ?? [], rating: s.game.rating } : undefined,
            }));

            if (mappedReviews.length === 0 && mappedStatuses.length === 0) return [];

            // Use top genres to search for candidates via IGDB
            const vector = buildPreferenceVector(mappedReviews as any, mappedStatuses as any);
            const topGenre = Object.entries(vector.genres).sort((a, b) => b[1] - a[1])[0]?.[0];
            if (!topGenre) return [];

            const { results: candidates } = await gamesApi.search(topGenre, 1);
            const playedIds = new Set([...mappedReviews.map((r) => r.gameId), ...mappedStatuses.map((s) => s.gameId)]);
            const unseenCandidates = candidates.filter((c) => !playedIds.has(c.providerId));

            return recommend(unseenCandidates, mappedReviews as any, mappedStatuses as any, 5);
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 10,
    });

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>Discover</Text>
                </View>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="bulb" size={18} color={colors.purple[400]} />
                            <Text style={styles.sectionTitle}>Recommended For You</Text>
                        </View>
                        {recommendations.map((rec) => (
                            <View key={rec.game.providerId}>
                                <GameCard game={rec.game} onPress={() => router.push(`/game/${rec.game.providerId}`)} />
                                <Text style={styles.reasonText}>✦ {rec.reason}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Activity Feed */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people" size={18} color={colors.purple[400]} />
                        <Text style={styles.sectionTitle}>Friend Activity</Text>
                    </View>
                    {feedLoading ? (
                        <ActivityIndicator color={colors.purple[400]} />
                    ) : feed.length === 0 ? (
                        <View style={styles.emptyFeed}>
                            <Text style={styles.emptyText}>Follow friends to see their activity here.</Text>
                        </View>
                    ) : (
                        feed.map((event) => <ActivityEventCard key={event.id} event={event} />)
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function ActivityEventCard({ event }: { event: ActivityEvent }) {
    const meta = event.metadata as any;
    const actorName = event.actor?.displayName ?? 'Someone';

    const getLabel = () => {
        switch (event.type) {
            case 'review': return `${actorName} reviewed ${meta.game_title ?? 'a game'}`;
            case 'rating': return `${actorName} rated ${meta.game_title ?? 'a game'} ${meta.rating ?? ''}★`;
            case 'status_change': return `${actorName} added ${meta.game_title ?? 'a game'} to ${meta.status}`;
            case 'list_add': return `${actorName} added ${meta.game_title ?? 'a game'} to "${meta.list_title ?? 'a list'}"`;
            case 'follow': return `${actorName} followed someone`;
            default: return `${actorName} did something`;
        }
    };

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <View style={styles.eventCard}>
            <View style={styles.eventAvatar}>
                <Ionicons name="person" size={16} color={colors.text.muted} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.eventLabel}>{getLabel()}</Text>
                <Text style={styles.eventTime}>{timeAgo(event.createdAt)}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    scroll: { flexGrow: 1, paddingBottom: spacing.xl },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.base },
    title: { fontSize: typography.size['2xl'], fontFamily: 'Inter_700Bold', color: colors.text.primary },
    section: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    sectionTitle: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    reasonText: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.purple[400], paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
    emptyFeed: { backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
    emptyText: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textAlign: 'center' },
    eventCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    eventAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
    eventLabel: { fontSize: typography.size.sm, fontFamily: 'Inter_400Regular', color: colors.text.primary, lineHeight: 18 },
    eventTime: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.muted, marginTop: 4 },
});
