import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { StarRating } from '../../../src/components/ui/StarRating';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { PlaySession } from '../../../src/domain/types';
import { supabase } from '../../../src/lib/supabase';
import { withTimeout } from '../../../src/lib/withTimeout';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, radius, spacing, typography, PLATFORM_COLORS } from '../../../src/styles/tokens';
import { useAppTheme } from '../../../src/theme/appTheme';

interface DiaryGameOption {
    id: string;
    title: string;
    coverUrl?: string;
    releaseDate?: string;
}

function formatCardDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDiaryDate(date: Date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

function toIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function shiftDays(date: Date, delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
}

function groupByMonth(sessions: PlaySession[]) {
    const groups: Record<string, PlaySession[]> = {};
    for (const s of sessions) {
        const key = new Date(s.playedOn).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        groups[key] = groups[key] ?? [];
        groups[key].push(s);
    }
    return Object.entries(groups);
}

// Session card with glow effect
function SessionCard({ session, onPress }: { session: PlaySession; onPress?: () => void }) {
    const { theme } = useAppTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
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
        >
            <Animated.View
                style={[
                    styles.sessionCard,
                    {
                        transform: [{ scale: scaleAnim }],
                        backgroundColor: theme.colors.surface.glassStrong,
                        borderColor: theme.colors.border,
                        shadowColor: theme.colors.surface.cardShadow,
                    },
                ]}
            >
                <LinearGradient
                    colors={[`${theme.colors.hero.primary}14`, `${theme.colors.hero.secondary}08`, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.sessionRow}>
                    {/* Date column */}
                    <View style={styles.dateColumn}>
                        <Text style={[styles.sessionDay, { color: theme.colors.text.primary }]}>
                            {new Date(session.playedOn).getDate()}
                        </Text>
                        <Text style={[styles.sessionMonth, { color: theme.colors.text.secondary }]}>
                            {new Date(session.playedOn).toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                    </View>

                    {/* Timeline connector */}
                    <View style={styles.timelineContainer}>
                        <View style={[styles.timelineDot, { backgroundColor: theme.colors.hero.primary }]} />
                        <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />
                    </View>

                    {/* Content */}
                    <View style={styles.sessionContent}>
                        {/* Game cover + info */}
                        <View style={styles.sessionHeader}>
                            {session.game?.coverUrl ? (
                                <Image
                                    source={{ uri: session.game.coverUrl }}
                                    style={styles.sessionCover}
                                    contentFit="cover"
                                    transition={150}
                                />
                            ) : (
                                <View style={styles.sessionCoverPlaceholder}>
                                    <Ionicons name="game-controller" size={16} color={theme.colors.text.muted} />
                                </View>
                            )}
                            <View style={styles.sessionInfo}>
                                <Text style={[styles.sessionGame, { color: theme.colors.text.primary }]} numberOfLines={2}>
                                    {session.game?.title ?? 'Unknown Game'}
                                </Text>
                                {session.firstTimePlay && (
                                    <View style={[styles.firstPlayBadge, { backgroundColor: `${theme.colors.hero.quaternary}16` }]}>
                                        <Ionicons name="ribbon" size={10} color={theme.colors.hero.quaternary} />
                                        <Text style={[styles.firstPlayText, { color: theme.colors.hero.quaternary }]}>First playthrough</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Notes */}
                        {session.notes && (
                            <Text style={[styles.sessionNotes, { color: theme.colors.text.secondary }]} numberOfLines={2}>{session.notes}</Text>
                        )}

                        {/* Platform */}
                        {session.platform && (
                            <View style={styles.sessionPlatform}>
                                <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[session.platform] || theme.colors.text.muted }]} />
                                <Text style={[styles.platformText, { color: theme.colors.text.secondary }]}>{session.platform}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
}

// Month header component
function MonthHeader({ month, count }: { month: string; count: number }) {
    const { theme } = useAppTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.monthHeader, { opacity: fadeAnim, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.monthLabel, { color: theme.colors.text.primary }]}>{month}</Text>
            <View style={[styles.monthCount, { backgroundColor: theme.colors.surface.glassStrong }]}>
                <Text style={[styles.monthCountText, { color: theme.colors.text.secondary }]}>{count} sessions</Text>
            </View>
        </Animated.View>
    );
}

export default function DiaryScreen() {
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const { theme } = useAppTheme();
    const [showAdd, setShowAdd] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGame, setSelectedGame] = useState<DiaryGameOption | null>(null);
    const [playedOn, setPlayedOn] = useState(new Date());
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [firstTimePlay, setFirstTimePlay] = useState(false);
    const [noSpoilers, setNoSpoilers] = useState(true);

    const resetForm = () => {
        setSearchQuery('');
        setSelectedGame(null);
        setPlayedOn(new Date());
        setRating(0);
        setReviewText('');
        setFirstTimePlay(false);
        setNoSpoilers(true);
    };

    const closeModal = () => {
        setShowAdd(false);
        resetForm();
    };

    const { data: sessions = [], isLoading } = useQuery<PlaySession[]>({
        queryKey: ['play-sessions', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('play_sessions')
                    .select('*, game:games(title, cover_url)')
                    .eq('user_id', user.id)
                    .order('played_on', { ascending: false }),
                8_000,
                'Load diary sessions'
            );
            if (error) {
                console.warn('[Diary] sessions error:', error.message);
                return [];
            }
            return (data ?? []).map((s) => ({
                id: s.id,
                userId: s.user_id,
                gameId: s.game_id,
                playedOn: s.played_on,
                firstTimePlay: s.first_time_play ?? false,
                minutes: s.minutes,
                platform: s.platform,
                notes: s.notes,
                createdAt: s.created_at,
                game: s.game ? { title: s.game.title, coverUrl: s.game.cover_url } : undefined,
            }));
        },
        enabled: !!user,
    });

    const normalizedSearch = searchQuery.trim();
    const { data: gameOptions = [], isFetching: isSearchingGames } = useQuery<DiaryGameOption[]>({
        queryKey: ['diary-game-search', normalizedSearch],
        queryFn: async () => {
            const { data, error } = await withTimeout(
                supabase
                    .from('games')
                    .select('id,title,cover_url,release_date')
                    .ilike('title', `%${normalizedSearch}%`)
                    .order('title', { ascending: true })
                    .limit(12),
                8_000,
                'Search diary games'
            );
            if (error) throw error;
            return (data ?? []).map((g) => ({
                id: g.id,
                title: g.title,
                coverUrl: g.cover_url ?? undefined,
                releaseDate: g.release_date ?? undefined,
            }));
        },
        enabled: showAdd && !selectedGame && normalizedSearch.length >= 2,
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('Not signed in');
            if (!selectedGame) throw new Error('Select a game');
            if (rating <= 0) throw new Error('Rating is required');
            if (!reviewText.trim()) throw new Error('Review text is required');

            const playedOnIso = toIsoDate(playedOn);

            const { error: sessionError } = await withTimeout(
                supabase.from('play_sessions').insert({
                    user_id: user.id,
                    game_id: selectedGame.id,
                    played_on: playedOnIso,
                    first_time_play: firstTimePlay,
                    notes: null,
                }),
                8_000,
                'Create diary session'
            );
            if (sessionError) throw sessionError;

            const { error: reviewError } = await withTimeout(
                supabase.from('reviews').upsert({
                    user_id: user.id,
                    game_id: selectedGame.id,
                    rating,
                    review_text: reviewText.trim(),
                    spoiler: !noSpoilers,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,game_id' }),
                8_000,
                'Save diary review'
            );
            if (reviewError) throw reviewError;

            const { error: statusError } = await withTimeout(
                supabase.from('user_game_status').upsert({
                    user_id: user.id,
                    game_id: selectedGame.id,
                    status: 'played',
                    last_updated: new Date().toISOString(),
                }),
                8_000,
                'Mark game as played'
            );
            if (statusError) throw statusError;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['play-sessions'] });
            qc.invalidateQueries({ queryKey: ['profile-statuses'] });
            qc.invalidateQueries({ queryKey: ['profile-reviews'] });
            closeModal();
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
    });

    const grouped = groupByMonth(sessions);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: theme.colors.text.primary }]}>Diary</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.hero.primary }]}>Your gaming journey</Text>
                </View>
                <View style={styles.headerControls}>
                    <ThemeModeToggle compact />
                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.colors.hero.primary, shadowColor: theme.colors.hero.primary }]} onPress={() => setShowAdd(true)}>
                        <Ionicons name="add" size={24} color={theme.colors.bg.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            <LinearGradient
                colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
            >
                <View>
                    <Text style={styles.heroLabel}>Timeline</Text>
                    <Text style={styles.heroValue}>{sessions.length}</Text>
                    <Text style={styles.heroCopy}>logged sessions in your backlog</Text>
                </View>
                <TouchableOpacity style={styles.heroAction} onPress={() => setShowAdd(true)}>
                    <Text style={styles.heroActionText}>Add Entry</Text>
                </TouchableOpacity>
            </LinearGradient>

            {/* Content */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.hero.primary} />
                </View>
            ) : sessions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surface.glassStrong }]}>
                        <Ionicons name="calendar-outline" size={48} color={theme.colors.text.muted} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No entries yet</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>Log your first gaming session to start your diary</Text>
                    <TouchableOpacity style={[styles.emptyButton, { backgroundColor: theme.colors.hero.primary }]} onPress={() => setShowAdd(true)}>
                        <Ionicons name="add" size={18} color={theme.colors.bg.primary} />
                        <Text style={styles.emptyButtonText}>Add Entry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={grouped}
                    keyExtractor={([month]) => month}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item: [month, slist], index }) => (
                        <View style={styles.monthSection}>
                            <MonthHeader month={month} count={slist.length} />
                            <View style={styles.sessionsList}>
                                {slist.map((session) => (
                                    <SessionCard
                                        key={session.id}
                                        session={session}
                                    />
                                ))}
                            </View>
                        </View>
                    )}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Add Modal */}
            <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
                <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.bg.primary }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                        <TouchableOpacity onPress={closeModal}>
                            <Text style={[styles.cancelBtn, { color: theme.colors.text.secondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>New Entry</Text>
                        <TouchableOpacity
                            onPress={() => addMutation.mutate()}
                            disabled={addMutation.isPending || !selectedGame || rating <= 0 || !reviewText.trim()}
                        >
                            <Text style={[
                                styles.saveBtn,
                                { color: theme.colors.hero.primary },
                                (addMutation.isPending || !selectedGame || rating <= 0 || !reviewText.trim()) && { opacity: 0.4 },
                            ]}>
                                {addMutation.isPending ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                        {/* Game selection */}
                        <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Game *</Text>
                        {selectedGame ? (
                            <View style={[styles.selectedGameCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                                {selectedGame.coverUrl && (
                                    <Image source={{ uri: selectedGame.coverUrl }} style={styles.selectedGameCover} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.selectedGameTitle, { color: theme.colors.text.primary }]}>{selectedGame.title}</Text>
                                    {selectedGame.releaseDate && (
                                        <Text style={[styles.selectedGameYear, { color: theme.colors.text.secondary }]}>
                                            {new Date(selectedGame.releaseDate).getFullYear()}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setSelectedGame(null)}>
                                    <Text style={[styles.changeBtn, { color: theme.colors.hero.primary }]}>Change</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border, color: theme.colors.text.primary }]}
                                    placeholder="Search games..."
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    selectionColor={theme.colors.hero.primary}
                                    autoFocus
                                />
                                {normalizedSearch.length >= 2 && (
                                    <View style={[styles.searchResults, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                                        {isSearchingGames ? (
                                            <ActivityIndicator color={theme.colors.hero.primary} style={{ paddingVertical: spacing.lg }} />
                                        ) : gameOptions.length === 0 ? (
                                            <Text style={[styles.noResultsText, { color: theme.colors.text.secondary }]}>No matching games found</Text>
                                        ) : (
                                            gameOptions.map((game) => (
                                                <TouchableOpacity
                                                    key={game.id}
                                                    style={[styles.searchResultRow, { borderBottomColor: theme.colors.border }]}
                                                    onPress={() => {
                                                        setSelectedGame(game);
                                                        setSearchQuery('');
                                                    }}
                                                >
                                                    <Text style={[styles.searchResultTitle, { color: theme.colors.text.primary }]}>{game.title}</Text>
                                                    {game.releaseDate && (
                                                        <Text style={[styles.searchResultYear, { color: theme.colors.text.secondary }]}>
                                                            {new Date(game.releaseDate).getFullYear()}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </View>
                                )}
                            </>
                        )}

                        {/* Date picker */}
                        <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Played On *</Text>
                        <View style={[styles.dateRow, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <TouchableOpacity
                                style={[styles.dateAdjustBtn, { backgroundColor: theme.colors.bg.secondary }]}
                                onPress={() => setPlayedOn((d) => shiftDays(d, -1))}
                            >
                                <Ionicons name="chevron-back" size={18} color={theme.colors.text.secondary} />
                            </TouchableOpacity>
                            <Text style={[styles.dateValue, { color: theme.colors.text.primary }]}>{formatDiaryDate(playedOn)}</Text>
                            <TouchableOpacity
                                style={[styles.dateAdjustBtn, { backgroundColor: theme.colors.bg.secondary }]}
                                onPress={() => setPlayedOn((d) => shiftDays(d, 1))}
                            >
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => setPlayedOn(new Date())}>
                            <Text style={[styles.todayBtn, { color: theme.colors.hero.primary }]}>Use Today</Text>
                        </TouchableOpacity>

                        {/* Rating */}
                        <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Rating *</Text>
                        <View style={[styles.ratingBlock, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <StarRating value={rating} onChange={setRating} size={36} />
                        </View>

                        {/* Review */}
                        <Text style={[styles.fieldLabel, { color: theme.colors.text.secondary }]}>Review *</Text>
                        <TextInput
                            style={[
                                styles.input,
                                styles.textArea,
                                { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border, color: theme.colors.text.primary },
                            ]}
                            placeholder="Write your thoughts..."
                            placeholderTextColor={theme.colors.text.muted}
                            value={reviewText}
                            onChangeText={setReviewText}
                            multiline
                            textAlignVertical="top"
                            selectionColor={theme.colors.hero.primary}
                        />

                        {/* Toggles */}
                        <View style={[styles.toggleRow, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.toggleLabel, { color: theme.colors.text.primary }]}>First time playing</Text>
                                <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary }]}>Mark as first playthrough</Text>
                            </View>
                            <Switch
                                value={firstTimePlay}
                                onValueChange={setFirstTimePlay}
                                trackColor={{ false: theme.colors.border, true: theme.colors.hero.quaternary }}
                                thumbColor={theme.colors.white}
                            />
                        </View>

                        <View style={[styles.toggleRow, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.toggleLabel, { color: theme.colors.text.primary }]}>No spoilers</Text>
                                <Text style={[styles.toggleDescription, { color: theme.colors.text.secondary }]}>Hide from activity feed</Text>
                            </View>
                            <Switch
                                value={noSpoilers}
                                onValueChange={setNoSpoilers}
                                trackColor={{ false: theme.colors.border, true: theme.colors.hero.primary }}
                                thumbColor={theme.colors.white}
                            />
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    title: {
        fontSize: typography.size['2xl'],
        fontFamily: 'Inter_700Bold',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: colors.neon.cyan,
        marginTop: 2,
    },
    addBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.neon.cyan,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.neon.cyan,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    heroCard: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: radius.xl,
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: spacing.base,
    },
    heroLabel: {
        color: colors.white,
        fontSize: typography.size.xs,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroValue: {
        marginTop: spacing.xs,
        color: colors.white,
        fontSize: typography.size['3xl'],
        fontFamily: 'Inter_700Bold',
    },
    heroCopy: {
        color: colors.white,
        opacity: 0.82,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
    },
    heroAction: {
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    heroActionText: {
        color: colors.black,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_700Bold',
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIcon: {
        marginBottom: spacing.lg,
        padding: spacing.xl,
        backgroundColor: colors.bg.card,
        borderRadius: radius.full,
    },
    emptyTitle: {
        fontSize: typography.size.xl,
        fontFamily: 'Inter_700Bold',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.neon.cyan,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.full,
    },
    emptyButtonText: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: colors.bg.primary,
    },

    // List
    listContent: {
        padding: spacing.lg,
        paddingBottom: spacing['3xl'],
    },
    monthSection: {
        marginBottom: spacing.xl,
    },

    // Month header
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    monthLabel: {
        fontSize: typography.size.lg,
        fontFamily: 'Inter_700Bold',
        color: colors.neon.cyan,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    monthCount: {
        backgroundColor: colors.bg.card,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full,
    },
    monthCountText: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_500Medium',
        color: colors.text.muted,
    },

    // Sessions
    sessionsList: {
        gap: spacing.sm,
    },
    sessionCard: {
        backgroundColor: colors.bg.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    sessionRow: {
        flexDirection: 'row',
    },
    dateColumn: {
        width: 50,
        alignItems: 'center',
    },
    sessionDay: {
        fontSize: typography.size['2xl'],
        fontFamily: 'Inter_700Bold',
        color: colors.text.primary,
    },
    sessionMonth: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_500Medium',
        color: colors.text.muted,
        textTransform: 'uppercase',
    },
    timelineContainer: {
        width: 24,
        alignItems: 'center',
        marginHorizontal: spacing.sm,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.neon.cyan,
        marginTop: 6,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: colors.border,
        marginTop: spacing.xs,
    },
    sessionContent: {
        flex: 1,
    },
    sessionHeader: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    sessionCover: {
        width: 48,
        height: 64,
        borderRadius: radius.sm,
    },
    sessionCoverPlaceholder: {
        width: 48,
        height: 64,
        borderRadius: radius.sm,
        backgroundColor: colors.bg.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sessionInfo: {
        flex: 1,
        gap: 4,
    },
    sessionGame: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: colors.text.primary,
    },
    firstPlayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: colors.neon.lime + '15',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
    },
    firstPlayText: {
        fontSize: typography.size['2xs'],
        fontFamily: 'Inter_500Medium',
        color: colors.neon.lime,
    },
    sessionNotes: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: colors.text.secondary,
        marginTop: spacing.xs,
        fontStyle: 'italic',
    },
    sessionPlatform: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    platformDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    platformText: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: colors.text.muted,
    },

    // Modal
    modal: {
        flex: 1,
        backgroundColor: colors.bg.primary,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    cancelBtn: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: colors.text.secondary,
    },
    modalTitle: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: colors.text.primary,
    },
    saveBtn: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: colors.neon.cyan,
    },
    modalBody: {
        padding: spacing.lg,
        gap: spacing.md,
        paddingBottom: spacing['2xl'],
    },
    fieldLabel: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        padding: spacing.md,
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: colors.text.primary,
    },
    textArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    selectedGameCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
    },
    selectedGameCover: {
        width: 48,
        height: 64,
        borderRadius: radius.sm,
    },
    selectedGameTitle: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: colors.text.primary,
    },
    selectedGameYear: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: colors.text.secondary,
        marginTop: 2,
    },
    changeBtn: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: colors.neon.cyan,
    },
    searchResults: {
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    noResultsText: {
        padding: spacing.lg,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: colors.text.secondary,
        textAlign: 'center',
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    searchResultTitle: {
        flex: 1,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: colors.text.primary,
    },
    searchResultYear: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: colors.text.muted,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
    },
    dateAdjustBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.bg.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateValue: {
        flex: 1,
        fontSize: typography.size.base,
        fontFamily: 'Inter_500Medium',
        color: colors.text.primary,
        textAlign: 'center',
    },
    todayBtn: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: colors.neon.cyan,
        alignSelf: 'center',
    },
    ratingBlock: {
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        alignItems: 'center',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    toggleLabel: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_500Medium',
        color: colors.text.primary,
    },
    toggleDescription: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: colors.text.muted,
        marginTop: 2,
    },
});
