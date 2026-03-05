import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StarRating } from '../../src/components/ui/StarRating';
import type { GameDetail, GameStatus } from '../../src/domain/types';
import { gamesApi } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, radius, spacing, STATUS_ICONS, STATUS_LABELS, typography } from '../../src/styles/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_ORDER: GameStatus[] = ['played', 'playing', 'backlog', 'wishlist'];

export default function GameDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const [currentStatus, setCurrentStatus] = useState<GameStatus | null>(null);
    const [userRating, setUserRating] = useState<number>(0);

    const { data: game, isLoading } = useQuery<GameDetail>({
        queryKey: ['game-detail', id],
        queryFn: () => gamesApi.getById(id),
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    // Load user's existing status for this game
    useEffect(() => {
        if (!user || !game?.id) return;
        supabase
            .from('user_game_status')
            .select('status')
            .eq('user_id', user.id)
            .eq('game_id', game.id)
            .single()
            .then(({ data }) => {
                if (data) setCurrentStatus(data.status as GameStatus);
            });

        supabase
            .from('reviews')
            .select('rating')
            .eq('user_id', user.id)
            .eq('game_id', game.id)
            .single()
            .then(({ data }) => {
                if (data) setUserRating(data.rating);
            });
    }, [user, game?.id]);

    const statusMutation = useMutation({
        mutationFn: async (status: GameStatus | null) => {
            if (!user || !game?.id) return;
            if (status === null) {
                await supabase
                    .from('user_game_status')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('game_id', game.id);
            } else {
                await supabase
                    .from('user_game_status')
                    .upsert({ user_id: user.id, game_id: game.id, status, last_updated: new Date().toISOString() });

                // Write activity event
                await supabase.from('activity_events').insert({
                    actor_id: user.id,
                    type: 'status_change',
                    entity_id: game.id,
                    metadata: { game_title: game.title, cover_url: game.coverUrl, status },
                });
            }
        },
        onSuccess: (_, status) => {
            setCurrentStatus(status);
            qc.invalidateQueries({ queryKey: ['profile-stats', user?.id] });
        },
        onError: () => Alert.alert('Error', 'Could not update status'),
    });

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.purple[400]} />
            </View>
        );
    }

    if (!game) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Game not found.</Text>
            </SafeAreaView>
        );
    }

    const normalizedRating = game.rating ? (game.rating / 20).toFixed(1) : null;

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero image */}
                <View style={styles.heroContainer}>
                    {game.coverUrl ? (
                        <Image source={{ uri: game.coverUrl.replace('t_cover_big', 't_screenshot_big') }} style={styles.hero} contentFit="cover" />
                    ) : (
                        <View style={styles.heroPlaceholder} />
                    )}
                    <LinearGradient colors={['transparent', colors.bg.primary]} style={styles.heroGradient} />

                    {/* Back button */}
                    <SafeAreaView style={styles.backBtnWrapper}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={22} color={colors.white} />
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Cover + title row */}
                    <View style={styles.titleRow}>
                        {game.coverUrl && (
                            <Image source={{ uri: game.coverUrl }} style={styles.cover} contentFit="cover" />
                        )}
                        <View style={styles.titleInfo}>
                            <Text style={styles.title}>{game.title}</Text>
                            {game.releaseDate && (
                                <Text style={styles.meta}>{new Date(game.releaseDate).getFullYear()}</Text>
                            )}
                            {normalizedRating && (
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={14} color={colors.star} />
                                    <Text style={styles.ratingText}>{normalizedRating} IGDB</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Genre + platform chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {[...game.genres, ...game.platforms].slice(0, 6).map((tag) => (
                            <View key={tag} style={styles.chip}>
                                <Text style={styles.chipText}>{tag}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Description */}
                    {game.description && (
                        <Text style={styles.description}>{game.description}</Text>
                    )}

                    {/* --- User Actions --- */}
                    <View style={styles.actionsSection}>
                        <Text style={styles.sectionTitle}>Your Activity</Text>

                        {/* Status buttons */}
                        <View style={styles.statusButtons}>
                            {STATUS_ORDER.map((s) => {
                                const isActive = currentStatus === s;
                                return (
                                    <TouchableOpacity
                                        key={s}
                                        style={[styles.statusBtn, isActive && { borderColor: colors.status[s], backgroundColor: colors.status[s] + '20' }]}
                                        onPress={() => statusMutation.mutate(isActive ? null : s)}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name={STATUS_ICONS[s] as any} size={16} color={isActive ? colors.status[s] : colors.text.muted} />
                                        <Text style={[styles.statusBtnText, isActive && { color: colors.status[s] }]}>
                                            {STATUS_LABELS[s]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Rating */}
                        <View style={styles.ratingSection}>
                            <Text style={styles.ratingPrompt}>Your Rating</Text>
                            <StarRating
                                value={userRating}
                                onChange={setUserRating}
                                size={28}
                            />
                        </View>

                        {/* Write Review button */}
                        <TouchableOpacity
                            style={styles.reviewBtn}
                            onPress={() => router.push({ pathname: '/review-editor', params: { gameId: game.id, gameTitle: game.title } })}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="create-outline" size={18} color={colors.purple[400]} />
                            <Text style={styles.reviewBtnText}>Write a Review</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
    scroll: { paddingBottom: spacing['2xl'] },
    heroContainer: { height: 240, position: 'relative' },
    hero: { width: '100%', height: '100%' },
    heroPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.bg.tertiary },
    heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
    backBtnWrapper: { position: 'absolute', top: 0, left: 0 },
    backBtn: {
        margin: spacing.base,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    titleRow: { flexDirection: 'row', gap: spacing.base, marginBottom: spacing.md },
    cover: { width: 80, height: 110, borderRadius: radius.md, marginTop: -40 },
    titleInfo: { flex: 1, justifyContent: 'flex-end', gap: spacing.xs },
    title: { fontSize: typography.size.xl, fontFamily: 'Inter_700Bold', color: colors.text.primary, lineHeight: 26 },
    meta: { fontSize: typography.size.sm, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    ratingText: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.star },
    chipsRow: { gap: spacing.xs, paddingBottom: spacing.base },
    chip: { paddingHorizontal: spacing.base, paddingVertical: spacing.xs, backgroundColor: colors.bg.card, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
    chipText: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    description: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, lineHeight: 22, marginBottom: spacing.lg },
    actionsSection: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.base, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    statusBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    },
    statusBtnText: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.text.muted },
    ratingSection: { gap: spacing.xs },
    ratingPrompt: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.text.secondary },
    reviewBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        borderWidth: 1.5, borderColor: colors.purple[700],
        borderRadius: radius.md, padding: spacing.base,
        justifyContent: 'center',
    },
    reviewBtnText: { fontSize: typography.size.base, fontFamily: 'Inter_500Medium', color: colors.purple[400] },
    errorText: { color: colors.text.secondary, padding: spacing.lg },
});
