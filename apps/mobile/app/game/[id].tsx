import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '../../src/components/ui/StarRating';
import { ThemeBackdrop } from '../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../src/components/ui/ThemeModeToggle';
import type { CharacterCredit, GameDetail, GameStatus, GameSearchResult, InvolvedCompany } from '../../src/domain/types';
import { hexToRgba } from '../../src/hooks/useDynamicTheme';
import { gamesApi } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { withTimeout } from '../../src/lib/withTimeout';
import { useAuthStore } from '../../src/stores/authStore';
import { radius, spacing, typography, STATUS_LABELS, STATUS_ICONS, GENRE_COLORS, PLATFORM_COLORS } from '../../src/styles/tokens';
import { useAppTheme } from '../../src/theme/appTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = 320;

const STATUS_ORDER: GameStatus[] = ['played', 'playing', 'backlog', 'wishlist'];
type AppThemeType = ReturnType<typeof useAppTheme>['theme'];

// Animated shimmer for hero
function HeroShimmer() {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 3000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 3000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
    });

    return (
        <Animated.View
            style={[
                styles.heroShimmer,
                {
                    transform: [{ translateX }],
                    opacity: shimmerAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.15, 0],
                    }),
                },
            ]}
            pointerEvents="none"
        >
            <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
            />
        </Animated.View>
    );
}

// Status button with glow
function StatusButton({
    status,
    isActive,
    onPress,
    isLoading,
}: {
    status: GameStatus;
    isActive: boolean;
    onPress: () => void;
    isLoading: boolean;
}) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const statusColor = theme.colors.status[status];
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isActive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            glowAnim.setValue(0);
        }
    }, [isActive]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
            friction: 8,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
        }).start();
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
            disabled={isLoading}
        >
            <Animated.View
                style={[
                    styles.statusBtn,
                    {
                        transform: [{ scale: scaleAnim }],
                        borderColor: isActive ? statusColor : theme.colors.border,
                        backgroundColor: isActive ? `${statusColor}15` : theme.colors.surface.glassStrong,
                    },
                ]}
            >
                {/* Glow effect */}
                {isActive && (
                    <Animated.View
                        style={[
                            styles.statusBtnGlow,
                            {
                                backgroundColor: statusColor,
                                opacity: glowAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.1, 0.3],
                                }),
                            },
                        ]}
                    />
                )}
                <Ionicons
                    name={STATUS_ICONS[status] as any}
                    size={20}
                    color={isActive ? statusColor : theme.colors.text.muted}
                />
                <Text
                    style={[
                        styles.statusBtnText,
                        { color: isActive ? statusColor : theme.colors.text.muted },
                    ]}
                >
                    {STATUS_LABELS[status]}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

// Genre chip with dynamic colors
function GenreChip({ genre }: { genre: string }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const genreStyle = GENRE_COLORS[genre] || GENRE_COLORS.default;
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.genreChip,
                {
                    backgroundColor: genreStyle.bg,
                    borderColor: genreStyle.text + '30',
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        >
            <Text style={[styles.genreChipText, { color: genreStyle.text }]}>{genre}</Text>
        </Animated.View>
    );
}

// Platform indicator
function PlatformIndicator({ platform }: { platform: string }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const platformColor = PLATFORM_COLORS[platform] || theme.colors.text.muted;

    return (
        <View style={styles.platformIndicator}>
            <View style={[styles.platformDot, { backgroundColor: platformColor }]} />
            <Text style={[styles.platformText, { color: theme.colors.text.secondary }]}>{platform}</Text>
        </View>
    );
}

// Company Credits component
function CompanyCredits({ involvedCompanies }: { involvedCompanies?: InvolvedCompany[] }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    if (!involvedCompanies || involvedCompanies.length === 0) return null;

    const developers = Array.from(
        new Set(
            involvedCompanies
                .filter((company) => company.developer && company.company.name)
                .map((company) => company.company.name)
        )
    );
    const publishers = Array.from(
        new Set(
            involvedCompanies
                .filter((company) => company.publisher && company.company.name)
                .map((company) => company.company.name)
        )
    );

    if (developers.length === 0 && publishers.length === 0) return null;

    return (
        <View style={[styles.creditsSection, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
            {developers.length > 0 && (
                <View style={styles.creditRow}>
                    <Text style={[styles.creditLabel, { color: theme.colors.text.muted }]}>Developed by</Text>
                    <Text style={[styles.creditValue, { color: theme.colors.text.primary }]}>
                        {developers.join(', ')}
                    </Text>
                </View>
            )}
            {publishers.length > 0 && (
                <View style={styles.creditRow}>
                    <Text style={[styles.creditLabel, { color: theme.colors.text.muted }]}>Published by</Text>
                    <Text style={[styles.creditValue, { color: theme.colors.text.primary }]}>
                        {publishers.join(', ')}
                    </Text>
                </View>
            )}
        </View>
    );
}

function CharacterCredits({
    characters,
    accentColor,
}: {
    characters?: CharacterCredit[];
    accentColor: string;
}) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    if (!characters || characters.length === 0) return null;

    return (
        <View style={styles.characterSection}>
            <Text style={[styles.sectionTitle, styles.characterSectionTitle, { color: accentColor }]}>Cast</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.characterRow}
            >
                {characters.map((character) => (
                    <View
                        key={character.id}
                        style={[
                            styles.characterCard,
                            { borderColor: hexToRgba(accentColor, 0.35), backgroundColor: hexToRgba(accentColor, 0.08) },
                        ]}
                    >
                        {character.imageUrl ? (
                            <Image
                                source={{ uri: character.imageUrl }}
                                style={styles.characterImage}
                                contentFit="cover"
                                transition={150}
                            />
                        ) : (
                            <View style={[styles.characterPlaceholder, { backgroundColor: theme.colors.bg.secondary }]}>
                                <Ionicons name="person" size={18} color={accentColor} />
                            </View>
                        )}
                        <Text style={[styles.characterName, { color: theme.colors.text.primary }]} numberOfLines={2}>{character.name}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

export default function GameDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const qc = useQueryClient();
    const { user } = useAuthStore();
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const [currentStatus, setCurrentStatus] = useState<GameStatus | null>(null);
    const [userRating, setUserRating] = useState<number>(0);
    const [persistedRating, setPersistedRating] = useState<number>(0);
    const scrollY = useRef(new Animated.Value(0)).current;

    // Load game details
    const { data: game, isLoading } = useQuery<GameDetail>({
        queryKey: ['game-detail', id],
        queryFn: () => gamesApi.getById(id),
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 10,
        refetchOnMount: 'always',
    });

    const accentColor = theme.colors.hero.secondary;
    const accentSoft = theme.colors.hero.primary;
    const surfaceTint = theme.colors.surface.glassStrong;

    // Load user's existing status and rating
    const { data: userActivity } = useQuery({
        queryKey: ['game-user-activity', user?.id, game?.id],
        queryFn: async () => {
            if (!user || !game?.id) return { status: null as GameStatus | null, review: null as { rating: number } | null };

            const [{ data: statusData }, { data: reviewData }] = await Promise.all([
                withTimeout(
                    supabase
                        .from('user_game_status')
                        .select('status')
                        .eq('user_id', user.id)
                        .eq('game_id', game.id)
                        .maybeSingle(),
                    8_000,
                    'Load game status'
                ),
                withTimeout(
                    supabase
                        .from('reviews')
                        .select('rating')
                        .eq('user_id', user.id)
                        .eq('game_id', game.id)
                        .maybeSingle(),
                    8_000,
                    'Load user rating'
                ),
            ]);

            return {
                status: (statusData?.status as GameStatus | undefined) ?? null,
                review: reviewData ? { rating: Number(reviewData.rating) } : null,
            };
        },
        enabled: !!user && !!game?.id,
        staleTime: 1000 * 30,
    });

    useEffect(() => {
        if (!userActivity) return;
        setCurrentStatus(userActivity.status);
        const nextRating = userActivity.review?.rating ?? 0;
        setUserRating(nextRating);
        setPersistedRating(nextRating);
    }, [userActivity]);

    // Status mutation
    const statusMutation = useMutation({
        mutationFn: async (status: GameStatus | null) => {
            if (!user || !game?.id) throw new Error('You must be signed in');
            if (status === null) {
                const { error } = await withTimeout(
                    supabase.from('user_game_status').delete().eq('user_id', user.id).eq('game_id', game.id),
                    8_000,
                    'Remove status'
                );
                if (error) throw error;
            } else {
                const { error } = await withTimeout(
                    supabase.from('user_game_status').upsert({
                        user_id: user.id,
                        game_id: game.id,
                        status,
                        last_updated: new Date().toISOString(),
                    }),
                    8_000,
                    'Update status'
                );
                if (error) throw error;

                // Activity event
                await withTimeout(
                    supabase.from('activity_events').insert({
                        actor_id: user.id,
                        type: 'status_change',
                        entity_id: game.id,
                        metadata: { game_title: game.title, cover_url: game.coverUrl, status },
                    }),
                    8_000,
                    'Create activity'
                );
            }
        },
        onSuccess: (_, status) => {
            setCurrentStatus(status);
            qc.invalidateQueries({ queryKey: ['game-user-activity'] });
            qc.invalidateQueries({ queryKey: ['profile-statuses'] });
            qc.invalidateQueries({ queryKey: ['activity-feed-raw'] });
            qc.invalidateQueries({ queryKey: ['activity-feed-ranked'] });
            qc.invalidateQueries({ queryKey: ['discover-recommendations'] });
        },
        onError: (error: Error) => Alert.alert('Error', error.message),
    });

    // Rating mutation
    const ratingMutation = useMutation({
        mutationFn: async (newRating: number) => {
            if (!user || !game?.id) throw new Error('You must be signed in');

            const { data: existing } = await withTimeout(
                supabase.from('reviews').select('review_text, spoiler').eq('user_id', user.id).eq('game_id', game.id).maybeSingle(),
                8_000,
                'Load existing review'
            );

            const { error } = await withTimeout(
                supabase.from('reviews').upsert(
                    {
                        user_id: user.id,
                        game_id: game.id,
                        rating: newRating,
                        review_text: existing?.review_text ?? null,
                        spoiler: existing?.spoiler ?? false,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id,game_id' }
                ),
                8_000,
                'Save rating'
            );
            if (error) throw error;

            await withTimeout(
                supabase.from('activity_events').insert({
                    actor_id: user.id,
                    type: 'rating',
                    entity_id: game.id,
                    metadata: { game_title: game.title, cover_url: game.coverUrl, rating: newRating },
                }),
                8_000,
                'Create activity'
            );
        },
        onSuccess: (_, newRating) => {
            setPersistedRating(newRating);
            qc.invalidateQueries({ queryKey: ['game-user-activity'] });
            qc.invalidateQueries({ queryKey: ['profile-reviews'] });
            qc.invalidateQueries({ queryKey: ['activity-feed-raw'] });
            qc.invalidateQueries({ queryKey: ['activity-feed-ranked'] });
            qc.invalidateQueries({ queryKey: ['discover-recommendations'] });
        },
        onError: (error: Error) => {
            setUserRating(persistedRating);
            Alert.alert('Error', error.message);
        },
    });

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg.primary }]}>
                <ThemeBackdrop />
                <ActivityIndicator size="large" color={theme.colors.hero.primary} />
            </View>
        );
    }

    if (!game) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
                <ThemeBackdrop />
                <SafeAreaView style={styles.container}>
                    <Text style={[styles.errorText, { color: theme.colors.text.secondary }]}>Game not found.</Text>
                </SafeAreaView>
            </View>
        );
    }

    const normalizedRating = game.rating ? (game.rating / 20).toFixed(1) : null;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
            >
                {/* ===== HERO SECTION ===== */}
                <View style={styles.heroContainer}>
                    {/* Background image */}
                    {game.coverUrl ? (
                        <Animated.Image
                            source={{ uri: game.coverUrl.replace('t_cover_big', 't_screenshot_huge') }}
                            style={[
                                styles.heroBackground,
                                {
                                    transform: [{
                                        scale: scrollY.interpolate({
                                            inputRange: [-100, 0, 100],
                                            outputRange: [1.2, 1, 0.9],
                                        }),
                                    }],
                                },
                            ]}
                        />
                    ) : (
                        <View style={styles.heroPlaceholder} />
                    )}

                    {/* Gradients */}
                    <LinearGradient
                        colors={[
                            `${accentSoft}${theme.isDark ? '2C' : '1E'}`,
                            `${accentColor}${theme.isDark ? '62' : '42'}`,
                            theme.colors.bg.primary,
                        ]}
                        style={styles.heroGradient}
                    />
                    <HeroShimmer />

                    {/* Back button */}
                    <SafeAreaView style={styles.backButtonContainer}>
                        <View style={styles.heroTopBar}>
                            <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.colors.surface.overlay }]} onPress={() => router.back()}>
                                <Ionicons name="chevron-back" size={24} color={theme.colors.white} />
                            </TouchableOpacity>
                            <ThemeModeToggle compact />
                        </View>
                    </SafeAreaView>
                </View>

                {/* ===== CONTENT SECTION ===== */}
                <View style={styles.content}>
                    {/* Game cover + info row */}
                    <View style={[styles.gameHeader, { backgroundColor: surfaceTint, borderColor: hexToRgba(accentColor, 0.2) }]}>
                        <View style={styles.coverWrapper}>
                            <View style={[styles.coverGlow, { backgroundColor: accentColor }]} />
                            {game.coverUrl ? (
                                <Image
                                    source={{ uri: game.coverUrl }}
                                    style={[styles.gameCover, { borderColor: theme.colors.border }]}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.bg.secondary, borderColor: theme.colors.border }]}>
                                    <Ionicons name="game-controller" size={32} color={theme.colors.text.muted} />
                                </View>
                            )}
                        </View>

                        <View style={styles.gameInfo}>
                            <Text style={[styles.gameTitle, { color: theme.colors.text.primary }]} numberOfLines={3}>{game.title}</Text>
                            {game.releaseDate && (
                                <Text style={[styles.gameYear, { color: theme.colors.text.secondary }]}>{new Date(game.releaseDate).getFullYear()}</Text>
                            )}
                            {normalizedRating && (
                                <View style={[styles.communityRating, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                                    <Ionicons name="star" size={16} color={theme.colors.star} />
                                    <Text style={styles.ratingValue}>{normalizedRating}</Text>
                                    <Text style={[styles.ratingSource, { color: theme.colors.text.secondary }]}>IGDB</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Genre chips */}
                    {game.genres.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.genreRow}
                        >
                            {game.genres.map((genre) => (
                                <GenreChip key={genre} genre={genre} />
                            ))}
                        </ScrollView>
                    )}

                    {/* Platforms */}
                    {game.platforms.length > 0 && (
                        <View style={styles.platformsRow}>
                            {game.platforms.slice(0, 5).map((platform) => (
                                <PlatformIndicator key={platform} platform={platform} />
                            ))}
                            {game.platforms.length > 5 && (
                                <Text style={[styles.morePlatforms, { color: theme.colors.text.muted }]}>+{game.platforms.length - 5}</Text>
                            )}
                        </View>
                    )}

                    {/* Description */}
                    {game.description && (
                        <View style={[styles.descriptionSection, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: accentColor }]}>Overview</Text>
                            <Text style={[styles.descriptionText, { color: theme.colors.text.secondary }]}>{game.description}</Text>
                        </View>
                    )}

                    {/* Company Credits */}
                    <CompanyCredits involvedCompanies={game.involvedCompanies} />

                    {/* Character Credits */}
                    <CharacterCredits
                        characters={game.characterCredits}
                        accentColor={accentColor}
                    />

                    {/* ===== USER ACTIONS ===== */}
                    <View
                        style={[
                            styles.actionsSection,
                            {
                                borderColor: hexToRgba(accentColor, 0.35),
                                backgroundColor: surfaceTint,
                            },
                        ]}
                    >
                        <Text style={[styles.sectionTitle, { color: accentColor }]}>Your Activity</Text>

                        {/* Status buttons */}
                        <View style={styles.statusButtonsRow}>
                            {STATUS_ORDER.map((status) => (
                                <StatusButton
                                    key={status}
                                    status={status}
                                    isActive={currentStatus === status}
                                    onPress={() => statusMutation.mutate(currentStatus === status ? null : status)}
                                    isLoading={statusMutation.isPending}
                                />
                            ))}
                        </View>

                        {/* Rating */}
                        <View style={styles.ratingSection}>
                            <Text style={[styles.ratingLabel, { color: theme.colors.text.secondary }]}>Your Rating</Text>
                            <View style={styles.ratingContainer}>
                                <StarRating
                                    value={userRating}
                                    onChange={setUserRating}
                                    onCommit={(next) => {
                                        if (next === persistedRating || ratingMutation.isPending) return;
                                        ratingMutation.mutate(next);
                                    }}
                                    size={36}
                                />
                            </View>
                        </View>

                        {/* Write review button */}
                        <TouchableOpacity
                            style={[styles.reviewButton, { borderColor: accentColor, backgroundColor: hexToRgba(accentColor, 0.1) }]}
                            onPress={() => router.push({ pathname: '/review-editor', params: { gameId: game.id, gameTitle: game.title } })}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="create-outline" size={20} color={accentColor} />
                            <Text style={[styles.reviewButtonText, { color: accentColor }]}>Write a Review</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const createStyles = (theme: AppThemeType) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bg.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.bg.primary,
    },
    scrollContent: {
        paddingBottom: spacing['3xl'],
    },
    errorText: {
        color: theme.colors.text.secondary,
        padding: spacing.lg,
        textAlign: 'center',
    },

    // Hero section
    heroContainer: {
        height: HERO_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
    },
    heroBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: SCREEN_WIDTH * 1.5,
        marginLeft: -SCREEN_WIDTH * 0.25,
    },
    heroPlaceholder: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.bg.tertiary,
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    heroShimmer: {
        ...StyleSheet.absoluteFillObject,
    },
    backButtonContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    heroTopBar: {
        margin: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.surface.overlay,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Content
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },

    // Game header
    gameHeader: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginBottom: spacing.lg,
        borderRadius: radius.xl,
        borderWidth: 1,
        padding: spacing.lg,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: theme.isDark ? 0.22 : 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    coverWrapper: {
        position: 'relative',
        marginTop: -60,
    },
    coverGlow: {
        position: 'absolute',
        top: -8,
        left: -8,
        right: -8,
        bottom: -8,
        borderRadius: radius.lg + 8,
        opacity: 0.15,
    },
    gameCover: {
        width: 100,
        height: 140,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    coverPlaceholder: {
        width: 100,
        height: 140,
        borderRadius: radius.lg,
        backgroundColor: theme.colors.bg.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    gameInfo: {
        flex: 1,
        justifyContent: 'flex-end',
        gap: spacing.xs,
    },
    gameTitle: {
        fontSize: typography.size['2xl'],
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        lineHeight: 28,
    },
    gameYear: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    communityRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.xs,
        alignSelf: 'flex-start',
        borderRadius: radius.full,
        borderWidth: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
    },
    ratingValue: {
        fontSize: typography.size.lg,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.star,
    },
    ratingSource: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.muted,
    },

    // Genres
    genreRow: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    genreChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 1,
    },
    genreChipText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Platforms
    platformsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    platformIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    platformDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    platformText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    morePlatforms: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.muted,
    },

    // Description
    descriptionSection: {
        marginBottom: spacing.xl,
        borderRadius: radius.xl,
        borderWidth: 1,
        padding: spacing.lg,
    },
    descriptionText: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        lineHeight: 24,
        marginTop: spacing.sm,
    },

    // Company Credits
    creditsSection: {
        marginBottom: spacing.xl,
        gap: spacing.sm,
        borderRadius: radius.xl,
        borderWidth: 1,
        padding: spacing.lg,
    },
    creditRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.sm,
    },
    creditLabel: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.muted,
    },
    creditValue: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
        flex: 1,
    },

    // Character credits
    characterSection: {
        marginBottom: spacing.xl,
    },
    characterSectionTitle: {
        marginBottom: spacing.md,
    },
    characterRow: {
        gap: spacing.sm,
    },
    characterCard: {
        width: 104,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        gap: spacing.sm,
    },
    characterImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: radius.md,
        backgroundColor: theme.colors.bg.secondary,
    },
    characterPlaceholder: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg.secondary,
    },
    characterName: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.primary,
        lineHeight: 18,
    },

    // Actions section
    actionsSection: {
        backgroundColor: theme.colors.surface.glassStrong,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: spacing.lg,
        gap: spacing.lg,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: theme.isDark ? 0.2 : 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    sectionTitle: {
        fontSize: typography.size.lg,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },

    // Status buttons
    statusButtonsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 2,
    },
    statusBtnGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radius.full,
    },
    statusBtnText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_600SemiBold',
    },

    // Rating
    ratingSection: {
        alignItems: 'center',
    },
    ratingLabel: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.secondary,
        marginBottom: spacing.sm,
    },
    ratingContainer: {
        paddingVertical: spacing.md,
    },

    // Review button
    reviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: theme.colors.hero.secondary,
        backgroundColor: `${theme.colors.hero.secondary}14`,
    },
    reviewButtonText: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.hero.secondary,
    },
});
