import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarPickerModal } from '../../../src/components/ui/CalendarPickerModal';
import { StarRating } from '../../../src/components/ui/StarRating';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { PlaySession } from '../../../src/domain/types';
import { supabase } from '../../../src/lib/supabase';
import { withTimeout } from '../../../src/lib/withTimeout';
import { useAuthStore } from '../../../src/stores/authStore';
import { PLATFORM_COLORS, radius, spacing, typography } from '../../../src/styles/tokens';
import { useAppTheme } from '../../../src/theme/appTheme';

interface DiaryGameOption {
    id: string;
    title: string;
    coverUrl?: string;
    releaseDate?: string;
}

interface DiaryEntry extends PlaySession {
    game: DiaryGameOption;
    rating?: number;
    reviewText?: string;
    spoiler?: boolean;
}

type AppThemeType = ReturnType<typeof useAppTheme>['theme'];

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function fromIsoDate(iso: string) {
    const [year, month, day] = iso.split('-').map((value) => Number(value));
    return new Date(year, month - 1, day);
}

function formatDiaryDate(date: Date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

function toIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function clampDiaryDate(date: Date) {
    const today = startOfDay(new Date());
    return startOfDay(date) > today ? today : startOfDay(date);
}

function shiftDays(date: Date, delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return clampDiaryDate(next);
}

function groupByMonth(sessions: DiaryEntry[]) {
    const groups: Record<string, DiaryEntry[]> = {};

    for (const session of sessions) {
        const key = fromIsoDate(session.playedOn).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });
        groups[key] = groups[key] ?? [];
        groups[key].push(session);
    }

    return Object.entries(groups);
}

function mapGameOption(game: any): DiaryGameOption {
    return {
        id: game.id,
        title: game.title,
        coverUrl: game.cover_url ?? undefined,
        releaseDate: game.release_date ?? undefined,
    };
}

async function cleanupDetachedDiaryData(userId: string, gameId: string, excludingSessionId?: string) {
    let remainingSessionsQuery = supabase
        .from('play_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('game_id', gameId);

    if (excludingSessionId) {
        remainingSessionsQuery = remainingSessionsQuery.neq('id', excludingSessionId);
    }

    const { count, error: countError } = await withTimeout(
        remainingSessionsQuery,
        8_000,
        'Check remaining diary sessions'
    );

    if (countError) throw countError;
    if ((count ?? 0) > 0) return;

    const [{ error: reviewError }, { error: statusError }] = await Promise.all([
        withTimeout(
            supabase.from('reviews').delete().eq('user_id', userId).eq('game_id', gameId),
            8_000,
            'Delete detached diary review'
        ),
        withTimeout(
            supabase
                .from('user_game_status')
                .delete()
                .eq('user_id', userId)
                .eq('game_id', gameId)
                .eq('status', 'played'),
            8_000,
            'Delete detached diary status'
        ),
    ]);

    if (reviewError) throw reviewError;
    if (statusError) throw statusError;
}

async function upsertDiaryReviewAndStatus(params: {
    userId: string;
    gameId: string;
    rating: number;
    reviewText: string;
    noSpoilers: boolean;
}) {
    const { userId, gameId, rating, reviewText, noSpoilers } = params;

    const [{ error: reviewError }, { error: statusError }] = await Promise.all([
        withTimeout(
            supabase.from('reviews').upsert({
                user_id: userId,
                game_id: gameId,
                rating,
                review_text: reviewText,
                spoiler: !noSpoilers,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,game_id' }),
            8_000,
            'Save diary review'
        ),
        withTimeout(
            supabase.from('user_game_status').upsert({
                user_id: userId,
                game_id: gameId,
                status: 'played',
                last_updated: new Date().toISOString(),
            }),
            8_000,
            'Mark diary game as played'
        ),
    ]);

    if (reviewError) throw reviewError;
    if (statusError) throw statusError;
}

function MonthHeader({ month, count }: { month: string; count: number }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <Animated.View style={[styles.monthHeader, { opacity: fadeAnim }]}>
            <Text style={styles.monthLabel}>{month}</Text>
            <View style={styles.monthCount}>
                <Text style={styles.monthCountText}>{count} entries</Text>
            </View>
        </Animated.View>
    );
}

function SessionCard({ session, onPress }: { session: DiaryEntry; onPress: () => void }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    return (
        <TouchableOpacity
            activeOpacity={0.92}
            onPress={onPress}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, friction: 8 }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
        >
            <Animated.View style={[styles.sessionCard, { transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient
                    colors={['#00000000', '#00000000', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.sessionRow}>
                    <View style={styles.dateColumn}>
                        <Text style={styles.sessionDay}>{fromIsoDate(session.playedOn).getDate()}</Text>
                        <Text style={styles.sessionMonth}>
                            {fromIsoDate(session.playedOn).toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                    </View>

                    <View style={styles.timelineContainer}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineLine} />
                    </View>

                    <View style={styles.sessionContent}>
                        <View style={styles.sessionHeader}>
                            {session.game.coverUrl ? (
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
                                <Text style={styles.sessionGame} numberOfLines={2}>
                                    {session.game.title}
                                </Text>
                                <View style={styles.sessionBadgeRow}>
                                    {typeof session.rating === 'number' ? (
                                        <View style={styles.ratingPill}>
                                            <Ionicons name="star" size={11} color={theme.colors.hero.secondary} />
                                            <Text style={styles.ratingPillText}>{session.rating.toFixed(1)}</Text>
                                        </View>
                                    ) : null}

                                    {session.firstTimePlay ? (
                                        <View style={styles.firstPlayBadge}>
                                            <Ionicons name="ribbon" size={10} color={theme.colors.hero.quaternary} />
                                            <Text style={styles.firstPlayText}>First play</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        {session.reviewText?.trim() ? (
                            <Text style={styles.sessionNotes} numberOfLines={3}>
                                {session.reviewText}
                            </Text>
                        ) : session.notes?.trim() ? (
                            <Text style={styles.sessionNotes} numberOfLines={3}>
                                {session.notes}
                            </Text>
                        ) : null}

                        <View style={styles.sessionFooter}>
                            {session.platform ? (
                                <View style={styles.sessionPlatform}>
                                    <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[session.platform] || theme.colors.text.muted }]} />
                                    <Text style={styles.platformText}>{session.platform}</Text>
                                </View>
                            ) : (
                                <Text style={styles.sessionMetaText}>{formatDiaryDate(fromIsoDate(session.playedOn))}</Text>
                            )}

                            <Text style={styles.editHint}>Tap to edit</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
}

export default function DiaryScreen() {
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const { theme } = useAppTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const today = useMemo(() => startOfDay(new Date()), []);

    const [showEditor, setShowEditor] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGame, setSelectedGame] = useState<DiaryGameOption | null>(null);
    const [playedOn, setPlayedOn] = useState(today);
    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [firstTimePlay, setFirstTimePlay] = useState(false);
    const [noSpoilers, setNoSpoilers] = useState(true);
    const [editingSession, setEditingSession] = useState<DiaryEntry | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const resetForm = () => {
        setSearchQuery('');
        setSelectedGame(null);
        setPlayedOn(today);
        setRating(0);
        setReviewText('');
        setFirstTimePlay(false);
        setNoSpoilers(true);
        setEditingSession(null);
        setConfirmDelete(false);
        setShowDatePicker(false);
    };

    const closeEditor = () => {
        setShowEditor(false);
        resetForm();
    };

    const openCreateModal = () => {
        resetForm();
        setShowEditor(true);
    };

    const populateForm = (session: DiaryEntry) => {
        setEditingSession(session);
        setSelectedGame(session.game);
        setPlayedOn(clampDiaryDate(fromIsoDate(session.playedOn)));
        setRating(session.rating ?? 0);
        setReviewText(session.reviewText ?? session.notes ?? '');
        setFirstTimePlay(Boolean(session.firstTimePlay));
        setNoSpoilers(!session.spoiler);
        setSearchQuery('');
        setConfirmDelete(false);
        setShowEditor(true);
    };

    const { data: sessions = [], isLoading } = useQuery<DiaryEntry[]>({
        queryKey: ['play-sessions', user?.id],
        queryFn: async () => {
            if (!user) return [];

            const [{ data: sessionRows, error: sessionError }, { data: reviewRows, error: reviewError }] = await Promise.all([
                withTimeout(
                    supabase
                        .from('play_sessions')
                        .select('id,user_id,game_id,played_on,first_time_play,minutes,platform,notes,created_at,game:games(id,title,cover_url,release_date)')
                        .eq('user_id', user.id)
                        .order('played_on', { ascending: false }),
                    8_000,
                    'Load diary sessions'
                ),
                withTimeout(
                    supabase
                        .from('reviews')
                        .select('game_id,rating,review_text,spoiler')
                        .eq('user_id', user.id),
                    8_000,
                    'Load diary reviews'
                ),
            ]);

            if (sessionError) throw sessionError;
            if (reviewError) throw reviewError;

            const reviewsByGameId = new Map<string, { rating?: number; review_text?: string; spoiler?: boolean }>();

            for (const review of reviewRows ?? []) {
                reviewsByGameId.set(review.game_id, review);
            }

            return (sessionRows ?? [])
                .filter((row: any) => !!row.game)
                .map((row: any) => {
                    const linkedReview = reviewsByGameId.get(row.game_id);

                    return {
                        id: row.id,
                        userId: row.user_id,
                        gameId: row.game_id,
                        playedOn: row.played_on,
                        firstTimePlay: row.first_time_play ?? false,
                        minutes: row.minutes ?? undefined,
                        platform: row.platform ?? undefined,
                        notes: row.notes ?? undefined,
                        createdAt: row.created_at,
                        game: mapGameOption(row.game),
                        rating: linkedReview?.rating ? Number(linkedReview.rating) : undefined,
                        reviewText: linkedReview?.review_text ?? undefined,
                        spoiler: linkedReview?.spoiler ?? false,
                    };
                });
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

            return (data ?? []).map((game) => ({
                id: game.id,
                title: game.title,
                coverUrl: game.cover_url ?? undefined,
                releaseDate: game.release_date ?? undefined,
            }));
        },
        enabled: showEditor && !selectedGame && normalizedSearch.length >= 2,
    });

    const invalidateDiaryQueries = () => {
        qc.invalidateQueries({ queryKey: ['play-sessions', user?.id] });
        qc.invalidateQueries({ queryKey: ['profile-statuses', user?.id] });
        qc.invalidateQueries({ queryKey: ['profile-reviews', user?.id] });
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('Not signed in');
            if (!selectedGame) throw new Error('Select a game');
            if (rating <= 0) throw new Error('Rating is required');
            if (!reviewText.trim()) throw new Error('Review text is required');

            const nextGameId = selectedGame.id;
            const sessionPayload = {
                user_id: user.id,
                game_id: nextGameId,
                played_on: toIsoDate(playedOn),
                first_time_play: firstTimePlay,
                notes: reviewText.trim(),
            };

            if (editingSession) {
                const previousGameId = editingSession.gameId;
                const { error } = await withTimeout(
                    supabase
                        .from('play_sessions')
                        .update(sessionPayload)
                        .eq('id', editingSession.id)
                        .eq('user_id', user.id),
                    8_000,
                    'Update diary entry'
                );
                if (error) throw error;

                if (previousGameId !== nextGameId) {
                    await cleanupDetachedDiaryData(user.id, previousGameId, editingSession.id);
                }
            } else {
                const { error } = await withTimeout(
                    supabase.from('play_sessions').insert(sessionPayload),
                    8_000,
                    'Create diary entry'
                );
                if (error) throw error;
            }

            await upsertDiaryReviewAndStatus({
                userId: user.id,
                gameId: nextGameId,
                rating,
                reviewText: reviewText.trim(),
                noSpoilers,
            });
        },
        onSuccess: () => {
            invalidateDiaryQueries();
            closeEditor();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!user || !editingSession) throw new Error('No diary entry selected');

            const { error } = await withTimeout(
                supabase
                    .from('play_sessions')
                    .delete()
                    .eq('id', editingSession.id)
                    .eq('user_id', user.id),
                8_000,
                'Delete diary entry'
            );
            if (error) throw error;

            await cleanupDetachedDiaryData(user.id, editingSession.gameId, editingSession.id);
        },
        onSuccess: () => {
            invalidateDiaryQueries();
            closeEditor();
        },
    });

    const groupedSessions = useMemo(() => groupByMonth(sessions), [sessions]);
    const saveDisabled = saveMutation.isPending || !selectedGame || rating <= 0 || !reviewText.trim();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.headerCopy}>
                        <Text style={styles.title}>Diary</Text>
                        <Text style={styles.subtitle}>Your gaming journey</Text>
                    </View>
                    <View style={styles.headerControls}>
                        <ThemeModeToggle compact />
                        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal} activeOpacity={0.9}>
                            <Ionicons name="add" size={22} color={theme.colors.bg.primary} />
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
                        <Text style={styles.heroCopy}>logged entries in your diary</Text>
                    </View>
                    <TouchableOpacity style={styles.heroAction} onPress={openCreateModal} activeOpacity={0.9}>
                        <Text style={styles.heroActionText}>Add Entry</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.hero.primary} />
                    </View>
                ) : sessions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="calendar-outline" size={44} color={theme.colors.text.muted} />
                        </View>
                        <Text style={styles.emptyTitle}>No entries yet</Text>
                        <Text style={styles.emptySubtitle}>Log your first gaming session to start your diary.</Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={openCreateModal} activeOpacity={0.9}>
                            <Ionicons name="add" size={18} color={theme.colors.bg.primary} />
                            <Text style={styles.emptyButtonText}>Add Entry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={groupedSessions}
                        keyExtractor={([month]) => month}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item: [month, monthSessions] }) => (
                            <View style={styles.monthSection}>
                                <MonthHeader month={month} count={monthSessions.length} />
                                <View style={styles.sessionsList}>
                                    {monthSessions.map((session) => (
                                        <SessionCard key={session.id} session={session} onPress={() => populateForm(session)} />
                                    ))}
                                </View>
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditor}>
                    <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.bg.primary }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeEditor}>
                                <Text style={styles.cancelBtn}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{editingSession ? 'Edit Entry' : 'New Entry'}</Text>
                            <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveDisabled}>
                                <Text style={[styles.saveBtn, saveDisabled && styles.disabledText]}>
                                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                            <LinearGradient
                                colors={[`${theme.colors.hero.primary}20`, `${theme.colors.hero.secondary}12`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalHero}
                            >
                                <Text style={styles.modalHeroTitle}>{editingSession ? 'Refine the entry' : 'Capture the session'}</Text>
                                <Text style={styles.modalHeroCopy}>Track the game, date, score, and your quick take in one place.</Text>
                            </LinearGradient>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Game *</Text>
                                {selectedGame ? (
                                    <View style={styles.selectedGameCard}>
                                        {selectedGame.coverUrl ? (
                                            <Image source={{ uri: selectedGame.coverUrl }} style={styles.selectedGameCover} contentFit="cover" transition={150} />
                                        ) : (
                                            <View style={styles.sessionCoverPlaceholder}>
                                                <Ionicons name="game-controller" size={16} color={theme.colors.text.muted} />
                                            </View>
                                        )}
                                        <View style={styles.selectedGameInfo}>
                                            <Text style={styles.selectedGameTitle}>{selectedGame.title}</Text>
                                            {selectedGame.releaseDate ? (
                                                <Text style={styles.selectedGameYear}>{new Date(selectedGame.releaseDate).getFullYear()}</Text>
                                            ) : null}
                                        </View>
                                        <TouchableOpacity onPress={() => setSelectedGame(null)}>
                                            <Text style={styles.changeBtn}>Change</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Search games..."
                                            placeholderTextColor={theme.colors.text.muted}
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                            selectionColor={theme.colors.hero.primary}
                                            autoFocus
                                        />

                                        {normalizedSearch.length >= 2 ? (
                                            <View style={styles.searchResults}>
                                                {isSearchingGames ? (
                                                    <ActivityIndicator color={theme.colors.hero.primary} style={{ paddingVertical: spacing.lg }} />
                                                ) : gameOptions.length === 0 ? (
                                                    <Text style={styles.noResultsText}>No matching games found.</Text>
                                                ) : (
                                                    gameOptions.map((game) => (
                                                        <TouchableOpacity
                                                            key={game.id}
                                                            style={styles.searchResultRow}
                                                            onPress={() => {
                                                                setSelectedGame(game);
                                                                setSearchQuery('');
                                                            }}
                                                        >
                                                            <Text style={styles.searchResultTitle}>{game.title}</Text>
                                                            {game.releaseDate ? (
                                                                <Text style={styles.searchResultYear}>{new Date(game.releaseDate).getFullYear()}</Text>
                                                            ) : null}
                                                        </TouchableOpacity>
                                                    ))
                                                )}
                                            </View>
                                        ) : null}
                                    </>
                                )}
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Played On *</Text>
                                <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.9}>
                                    <View>
                                        <Text style={styles.datePickerLabel}>Date</Text>
                                        <Text style={styles.datePickerValue}>{formatDiaryDate(playedOn)}</Text>
                                    </View>
                                    <Ionicons name="calendar-outline" size={20} color={theme.colors.hero.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setPlayedOn(today)}>
                                    <Text style={styles.todayBtn}>Use Today</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Rating *</Text>
                                <View style={styles.ratingBlock}>
                                    <StarRating value={rating} onChange={setRating} size={36} />
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Review *</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="What landed, what missed, and what made the session memorable?"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={reviewText}
                                    onChangeText={setReviewText}
                                    multiline
                                    textAlignVertical="top"
                                    selectionColor={theme.colors.hero.primary}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <View style={styles.toggleTextWrap}>
                                    <Text style={styles.toggleLabel}>First time playing</Text>
                                    <Text style={styles.toggleDescription}>Mark this as your first playthrough.</Text>
                                </View>
                                <Switch
                                    value={firstTimePlay}
                                    onValueChange={setFirstTimePlay}
                                    trackColor={{ false: theme.colors.border, true: theme.colors.hero.quaternary }}
                                    thumbColor={theme.colors.white}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <View style={styles.toggleTextWrap}>
                                    <Text style={styles.toggleLabel}>No spoilers</Text>
                                    <Text style={styles.toggleDescription}>Keep the attached review hidden in the feed.</Text>
                                </View>
                                <Switch
                                    value={noSpoilers}
                                    onValueChange={setNoSpoilers}
                                    trackColor={{ false: theme.colors.border, true: theme.colors.hero.primary }}
                                    thumbColor={theme.colors.white}
                                />
                            </View>

                            {editingSession ? (
                                <>
                                    {!confirmDelete ? (
                                        <TouchableOpacity style={styles.deleteButton} onPress={() => setConfirmDelete(true)} activeOpacity={0.9}>
                                            <Text style={styles.deleteButtonText}>Delete Entry</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.confirmDeleteCard}>
                                            <Text style={styles.confirmDeleteText}>
                                                Delete this diary entry? The linked played status and review will be cleaned up if nothing else references this game.
                                            </Text>
                                            <View style={styles.confirmDeleteActions}>
                                                <TouchableOpacity style={styles.confirmDeleteCancel} onPress={() => setConfirmDelete(false)} activeOpacity={0.9}>
                                                    <Text style={styles.confirmDeleteCancelText}>Keep It</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.confirmDeleteConfirm} onPress={() => deleteMutation.mutate()} activeOpacity={0.9}>
                                                    <Text style={styles.confirmDeleteConfirmText}>
                                                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </>
                            ) : null}
                        </ScrollView>

                        <CalendarPickerModal
                            visible={showDatePicker}
                            value={playedOn}
                            maxDate={today}
                            onChange={setPlayedOn}
                            onRequestClose={() => setShowDatePicker(false)}
                        />
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const createStyles = (theme: AppThemeType) => StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.base,
    },
    headerCopy: {
        flex: 1,
    },
    headerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    title: {
        fontSize: typography.size['2xl'],
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        marginTop: 4,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.hero.primary,
    },
    addBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.hero.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.hero.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.isDark ? 0.28 : 0.14,
        shadowRadius: 16,
        elevation: 8,
    },
    heroCard: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: radius.xl,
        padding: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: spacing.base,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: theme.isDark ? 0.24 : 0.1,
        shadowRadius: 22,
        elevation: 8,
    },
    heroLabel: {
        color: theme.colors.white,
        fontSize: typography.size.xs,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroValue: {
        marginTop: spacing.xs,
        color: theme.colors.white,
        fontSize: typography.size['3xl'],
        fontFamily: 'Inter_700Bold',
    },
    heroCopy: {
        color: 'rgba(255,255,255,0.82)',
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
    },
    heroAction: {
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: theme.isDark ? 'rgba(33, 20, 14, 0.74)' : 'rgba(255, 247, 239, 0.88)',
    },
    heroActionText: {
        color: theme.isDark ? theme.colors.white : theme.colors.text.primary,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_700Bold',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIcon: {
        marginBottom: spacing.lg,
        padding: spacing.xl,
        borderRadius: radius.full,
        backgroundColor: theme.colors.surface.glassStrong,
    },
    emptyTitle: {
        fontSize: typography.size.xl,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.full,
        backgroundColor: theme.colors.hero.primary,
    },
    emptyButtonText: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.bg.primary,
    },
    listContent: {
        padding: spacing.lg,
        paddingBottom: spacing['3xl'],
    },
    monthSection: {
        marginBottom: spacing.xl,
    },
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    monthLabel: {
        fontSize: typography.size.lg,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    monthCount: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full,
        backgroundColor: theme.colors.surface.glassStrong,
    },
    monthCountText: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.secondary,
    },
    sessionsList: {
        gap: spacing.sm,
    },
    sessionCard: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.md,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: theme.isDark ? 0.18 : 0.08,
        shadowRadius: 14,
        elevation: 3,
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
        color: theme.colors.text.primary,
    },
    sessionMonth: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.secondary,
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
        marginTop: 6,
        backgroundColor: theme.colors.hero.primary,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: spacing.xs,
        backgroundColor: theme.colors.border,
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
        backgroundColor: theme.colors.bg.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sessionInfo: {
        flex: 1,
        gap: 6,
    },
    sessionGame: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },
    sessionBadgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        alignItems: 'center',
    },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: radius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        backgroundColor: `${theme.colors.hero.secondary}18`,
    },
    ratingPillText: {
        fontSize: typography.size['2xs'],
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.secondary,
    },
    firstPlayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: `${theme.colors.hero.quaternary}16`,
    },
    firstPlayText: {
        fontSize: typography.size['2xs'],
        fontFamily: 'Inter_500Medium',
        color: theme.colors.hero.quaternary,
    },
    sessionNotes: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        marginTop: spacing.sm,
        lineHeight: 20,
    },
    sessionFooter: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    sessionPlatform: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    platformDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    platformText: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    sessionMetaText: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    editHint: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    modal: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    cancelBtn: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    modalTitle: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },
    saveBtn: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.hero.primary,
    },
    disabledText: {
        opacity: 0.4,
    },
    modalBody: {
        padding: spacing.lg,
        gap: spacing.md,
        paddingBottom: spacing['3xl'],
    },
    modalHero: {
        borderRadius: radius.lg,
        padding: spacing.lg,
    },
    modalHeroTitle: {
        fontSize: typography.size.xl,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    modalHeroCopy: {
        marginTop: spacing.sm,
        fontSize: typography.size.sm,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    fieldBlock: {
        gap: spacing.sm,
    },
    fieldLabel: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.md,
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.primary,
    },
    textArea: {
        minHeight: 140,
        textAlignVertical: 'top',
    },
    selectedGameCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.md,
        gap: spacing.md,
    },
    selectedGameInfo: {
        flex: 1,
    },
    selectedGameCover: {
        width: 52,
        height: 72,
        borderRadius: radius.sm,
    },
    selectedGameTitle: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },
    selectedGameYear: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
    changeBtn: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.hero.primary,
    },
    searchResults: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        overflow: 'hidden',
    },
    noResultsText: {
        padding: spacing.lg,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        textAlign: 'center',
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    searchResultTitle: {
        flex: 1,
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.primary,
    },
    searchResultYear: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.md,
    },
    datePickerLabel: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    datePickerValue: {
        marginTop: 4,
        fontSize: typography.size.base,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },
    todayBtn: {
        alignSelf: 'center',
        fontSize: typography.size.sm,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.hero.primary,
    },
    ratingBlock: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.lg,
        alignItems: 'center',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.md,
    },
    toggleTextWrap: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: typography.size.base,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.primary,
    },
    toggleDescription: {
        marginTop: 2,
        fontSize: typography.size.xs,
        lineHeight: 18,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    deleteButton: {
        marginTop: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: theme.colors.hero.tertiary,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    deleteButtonText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.tertiary,
    },
    confirmDeleteCard: {
        marginTop: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `${theme.colors.hero.tertiary}55`,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: spacing.md,
        gap: spacing.sm,
    },
    confirmDeleteText: {
        fontSize: typography.size.sm,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    confirmDeleteActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    confirmDeleteCancel: {
        flex: 1,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    confirmDeleteCancelText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
    },
    confirmDeleteConfirm: {
        flex: 1,
        borderRadius: radius.full,
        backgroundColor: theme.colors.hero.tertiary,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    confirmDeleteConfirmText: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.white,
    },
});
