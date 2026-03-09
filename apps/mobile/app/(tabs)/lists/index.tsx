import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Image } from 'expo-image';

import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { GameList, ListItem } from '../../../src/domain/types';
import { supabase } from '../../../src/lib/supabase';
import { withTimeout } from '../../../src/lib/withTimeout';
import { useAuthStore } from '../../../src/stores/authStore';
import { radius, spacing, typography } from '../../../src/styles/tokens';
import { useAppTheme } from '../../../src/theme/appTheme';

interface ListGameOption {
    id: string;
    title: string;
    coverUrl?: string;
    releaseDate?: string;
    providerId: string;
}

function mapGameOption(game: any): ListGameOption {
    return {
        id: game.id,
        title: game.title,
        coverUrl: game.cover_url ?? undefined,
        releaseDate: game.release_date ?? undefined,
        providerId: game.provider_game_id ?? game.id,
    };
}

function mapListItem(item: any): ListItem {
    return {
        listId: item.list_id,
        gameId: item.game_id,
        position: item.position,
        note: item.note ?? undefined,
        createdAt: item.created_at,
        game: item.game
            ? {
                id: item.game.id,
                providerId: item.game.provider_game_id ?? item.game.id,
                provider: 'igdb',
                title: item.game.title,
                coverUrl: item.game.cover_url ?? undefined,
                releaseDate: item.game.release_date ?? undefined,
                genres: [],
                platforms: [],
            }
            : undefined,
    };
}

function ListCard({ list, onPress }: { list: GameList; onPress: () => void }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const previewGames = (list.items ?? []).slice(0, 3);
    const visibilityAccent = list.isPublic
        ? (theme.isDark ? theme.colors.hero.quaternary : theme.colors.hero.tertiary)
        : theme.colors.text.secondary;

    return (
        <TouchableOpacity
            activeOpacity={0.92}
            onPress={onPress}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.985, useNativeDriver: true, friction: 8 }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
        >
            <Animated.View style={[styles.listCard, { transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient
                    colors={[`${theme.colors.hero.primary}22`, `${theme.colors.hero.secondary}10`, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.listCardHeader}>
                    <View style={styles.listIconWrap}>
                        <Ionicons name="albums" size={18} color={theme.colors.hero.primary} />
                    </View>
                    <View style={styles.listCardInfo}>
                        <Text style={styles.listTitle} numberOfLines={1}>{list.title}</Text>
                        {!!list.subtitle ? (
                            <Text style={styles.listSubtitle} numberOfLines={1}>{list.subtitle}</Text>
                        ) : null}
                        <Text style={styles.listDescription} numberOfLines={2}>
                            {list.description || 'A curated shelf waiting for more games.'}
                        </Text>
                    </View>
                </View>

                <View style={styles.previewRow}>
                    {previewGames.length > 0 ? (
                        previewGames.map((item, index) => (
                            item.game?.coverUrl ? (
                                <Image
                                    key={`${item.gameId}-${index}`}
                                    source={{ uri: item.game.coverUrl }}
                                    style={[styles.previewCover, index > 0 && styles.previewCoverOverlap]}
                                    contentFit="cover"
                                    transition={150}
                                />
                            ) : (
                                <View key={`${item.gameId}-${index}`} style={[styles.previewPlaceholder, index > 0 && styles.previewCoverOverlap]}>
                                    <Ionicons name="game-controller" size={16} color={theme.colors.text.muted} />
                                </View>
                            )
                        ))
                    ) : (
                        <View style={styles.emptyPreview}>
                            <Ionicons name="add-circle-outline" size={18} color={theme.colors.hero.primary} />
                            <Text style={styles.emptyPreviewText}>Add games</Text>
                        </View>
                    )}
                </View>

                <View style={styles.listMetaRow}>
                    <View style={styles.metaPill}>
                        <Ionicons name="game-controller" size={12} color={theme.colors.text.secondary} />
                        <Text style={styles.metaText}>{list.itemCount ?? 0} games</Text>
                    </View>
                    <View style={list.isPublic ? styles.publicPill : styles.privatePill}>
                        <Ionicons
                            name={list.isPublic ? 'globe-outline' : 'lock-closed-outline'}
                            size={12}
                            color={visibilityAccent}
                        />
                        <Text style={list.isPublic ? styles.publicText : styles.privateText}>
                            {list.isPublic ? 'Public' : 'Private'}
                        </Text>
                    </View>
                    <Text style={styles.editLabel}>Tap to edit</Text>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
}

export default function ListsScreen() {
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const heroButtonAccent = theme.isDark ? theme.colors.white : theme.colors.text.primary;
    const router = useRouter();
    const { editListId } = useLocalSearchParams<{ editListId?: string }>();

    const [showEditor, setShowEditor] = useState(false);
    const [editingList, setEditingList] = useState<GameList | null>(null);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGames, setSelectedGames] = useState<ListGameOption[]>([]);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const resetEditor = () => {
        setEditingList(null);
        setTitle('');
        setSubtitle('');
        setDescription('');
        setIsPublic(true);
        setSearchQuery('');
        setSelectedGames([]);
        setConfirmDelete(false);
    };

    const closeEditor = () => {
        setShowEditor(false);
        resetEditor();
    };

    const openCreate = () => {
        resetEditor();
        setShowEditor(true);
    };

    const openEdit = (list: GameList) => {
        setEditingList(list);
        setTitle(list.title);
        setSubtitle(list.subtitle ?? '');
        setDescription(list.description ?? '');
        setIsPublic(list.isPublic);
        setSearchQuery('');
        setSelectedGames(
            (list.items ?? [])
                .map((item) => item.game)
                .filter(Boolean)
                .map((game) => ({
                    id: game!.id!,
                    title: game!.title,
                    coverUrl: game!.coverUrl,
                    releaseDate: game!.releaseDate,
                    providerId: game!.providerId,
                }))
        );
        setConfirmDelete(false);
        setShowEditor(true);
    };

    const { data: lists = [], isLoading } = useQuery<GameList[]>({
        queryKey: ['lists', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('lists')
                    .select('id,user_id,title,subtitle,description,is_public,created_at,updated_at,list_items(list_id,game_id,position,note,created_at,game:games(id,provider_game_id,title,cover_url,release_date))')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false })
                    .order('position', { foreignTable: 'list_items', ascending: true }),
                8_000,
                'Load lists'
            );
            if (error) throw error;

            return (data ?? []).map((list: any) => {
                const items = (list.list_items ?? []).map(mapListItem);
                return {
                    id: list.id,
                    userId: list.user_id,
                    title: list.title,
                    subtitle: list.subtitle ?? undefined,
                    description: list.description ?? undefined,
                    isPublic: list.is_public,
                    createdAt: list.created_at,
                    updatedAt: list.updated_at,
                    itemCount: items.length,
                    items,
                } satisfies GameList;
            });
        },
        enabled: !!user,
    });

    useEffect(() => {
        if (!editListId || lists.length === 0) return;

        const targetList = lists.find((list) => list.id === editListId);
        if (!targetList) return;

        openEdit(targetList);
        router.setParams({ editListId: undefined });
    }, [editListId, lists, router]);

    const normalizedSearch = searchQuery.trim();
    const { data: gameOptions = [], isFetching: isSearchingGames } = useQuery<ListGameOption[]>({
        queryKey: ['list-game-search', normalizedSearch],
        queryFn: async () => {
            const { data, error } = await withTimeout(
                supabase
                    .from('games')
                    .select('id,provider_game_id,title,cover_url,release_date')
                    .ilike('title', `%${normalizedSearch}%`)
                    .order('title', { ascending: true })
                    .limit(12),
                8_000,
                'Search list games'
            );
            if (error) throw error;
            return (data ?? []).map(mapGameOption);
        },
        enabled: showEditor && normalizedSearch.length >= 2,
    });

    const availableGameOptions = useMemo(
        () => gameOptions.filter((option) => !selectedGames.some((selected) => selected.id === option.id)),
        [gameOptions, selectedGames]
    );

    const syncListItems = async (listId: string, games: ListGameOption[], previousGameIds: string[]) => {
        const nextGameIds = games.map((game) => game.id);
        const removedGameIds = previousGameIds.filter((id) => !nextGameIds.includes(id));

        if (removedGameIds.length > 0) {
            const { error } = await withTimeout(
                supabase
                    .from('list_items')
                    .delete()
                    .eq('list_id', listId)
                    .in('game_id', removedGameIds),
                8_000,
                'Remove list games'
            );
            if (error) throw error;
        }

        if (games.length > 0) {
            const { error } = await withTimeout(
                supabase.from('list_items').upsert(
                    games.map((game, index) => ({
                        list_id: listId,
                        game_id: game.id,
                        position: index,
                    })),
                    { onConflict: 'list_id,game_id' }
                ),
                8_000,
                'Save list games'
            );
            if (error) throw error;
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('Not signed in');
            if (!title.trim()) throw new Error('A list name is required');

            const payload = {
                title: title.trim(),
                subtitle: subtitle.trim() || null,
                description: description.trim() || null,
                is_public: isPublic,
            };

            if (editingList) {
                const { error } = await withTimeout(
                    supabase
                        .from('lists')
                        .update({
                            ...payload,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', editingList.id)
                        .eq('user_id', user.id),
                    8_000,
                    'Update list'
                );

                if (error) throw error;

                await syncListItems(
                    editingList.id,
                    selectedGames,
                    (editingList.items ?? []).map((item) => item.gameId)
                );

                return;
            }

            const { data, error } = await withTimeout(
                supabase
                    .from('lists')
                    .insert({
                        user_id: user.id,
                        ...payload,
                    })
                    .select('id')
                    .single(),
                8_000,
                'Create list'
            );

            if (error) throw error;

            await syncListItems(data.id, selectedGames, []);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lists', user?.id] });
            qc.invalidateQueries({ queryKey: ['profile-lists', user?.id] });
            closeEditor();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!user || !editingList) throw new Error('Choose a list to delete');
            const { error } = await withTimeout(
                supabase
                    .from('lists')
                    .delete()
                    .eq('id', editingList.id)
                    .eq('user_id', user.id),
                8_000,
                'Delete list'
            );
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lists', user?.id] });
            qc.invalidateQueries({ queryKey: ['profile-lists', user?.id] });
            closeEditor();
        },
    });

    const moveSelectedGame = (index: number, direction: -1 | 1) => {
        setSelectedGames((current) => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= current.length) return current;
            const next = [...current];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    };

    const saveDisabled = saveMutation.isPending || deleteMutation.isPending || !title.trim();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Lists</Text>
                    </View>
                    <ThemeModeToggle compact />
                </View>

                <LinearGradient
                    colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.quaternary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View>
                        <Text style={styles.heroLabel}>Collection Studio</Text>
                        <Text style={styles.heroNumber}>{lists.length}</Text>
                        <Text style={styles.heroCopy}>active lists in your library</Text>
                    </View>
                    <TouchableOpacity style={styles.heroButton} onPress={openCreate} activeOpacity={0.9}>
                        <Ionicons name="add" size={18} color={heroButtonAccent} />
                        <Text style={styles.heroButtonText}>New List</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {isLoading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator size="large" color={theme.colors.hero.primary} />
                    </View>
                ) : lists.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="layers-outline" size={30} color={theme.colors.text.muted} />
                        <Text style={styles.emptyTitle}>No lists yet</Text>
                        <Text style={styles.emptyCopy}>
                            Start with something specific, like "Tactical games with great party banter" or "Boss fights worth replaying."
                        </Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={openCreate} activeOpacity={0.88}>
                            <Text style={styles.emptyButtonText}>Create your first list</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={lists}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <ListCard list={item} onPress={() => openEdit(item)} />}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEditor}>
                    <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.bg.primary }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={closeEditor}>
                                <Text style={styles.modalAction}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{editingList ? 'Edit List' : 'New List'}</Text>
                            <TouchableOpacity onPress={() => saveMutation.mutate()} disabled={saveDisabled}>
                                <Text style={[styles.modalActionStrong, saveDisabled && styles.disabledText]}>
                                    {saveMutation.isPending ? 'Saving...' : editingList ? 'Save' : 'Create'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                            <LinearGradient
                                colors={[`${theme.colors.hero.primary}24`, `${theme.colors.hero.secondary}18`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalHero}
                            >
                                <Text style={styles.modalHeroTitle}>Shape the shelf</Text>
                                <Text style={styles.modalHeroCopy}>Give the list a name, a clear angle, and a lineup of games pulled straight from your database.</Text>
                            </LinearGradient>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>List Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Best RPGs for long weekends"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={title}
                                    onChangeText={setTitle}
                                    selectionColor={theme.colors.hero.primary}
                                    autoFocus
                                />
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Subheading</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Slow-burn adventures worth sinking into"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={subtitle}
                                    onChangeText={setSubtitle}
                                    selectionColor={theme.colors.hero.primary}
                                />
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Description</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="What makes this collection distinct?"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    textAlignVertical="top"
                                    selectionColor={theme.colors.hero.primary}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <View style={styles.toggleTextWrap}>
                                    <Text style={styles.toggleTitle}>Public list</Text>
                                    <Text style={styles.toggleCopy}>Allow other players to discover and follow this shelf.</Text>
                                </View>
                                <Switch
                                    value={isPublic}
                                    onValueChange={setIsPublic}
                                    trackColor={{ false: theme.colors.border, true: theme.colors.hero.primary }}
                                    thumbColor={theme.colors.white}
                                />
                            </View>

                            <View style={styles.fieldBlock}>
                                <View style={styles.gamesHeader}>
                                    <Text style={styles.fieldLabel}>Games</Text>
                                    <Text style={styles.gamesCount}>{selectedGames.length} selected</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Search your database to add games"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    selectionColor={theme.colors.hero.primary}
                                />

                                {normalizedSearch.length >= 2 ? (
                                    <View style={styles.searchResults}>
                                        {isSearchingGames ? (
                                            <ActivityIndicator color={theme.colors.hero.primary} style={styles.searchSpinner} />
                                        ) : availableGameOptions.length === 0 ? (
                                            <Text style={styles.noResultsText}>No matching games left to add.</Text>
                                        ) : (
                                            availableGameOptions.map((game, index) => (
                                                <TouchableOpacity
                                                    key={game.id}
                                                    style={[styles.searchResultRow, index === availableGameOptions.length - 1 && styles.searchResultRowLast]}
                                                    onPress={() => {
                                                        setSelectedGames((current) => [...current, game]);
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
                                ) : (
                                    <Text style={styles.helperText}>Type at least two characters to pull games from the database.</Text>
                                )}
                            </View>

                            {selectedGames.length === 0 ? (
                                <View style={styles.selectedEmpty}>
                                    <Ionicons name="add-circle-outline" size={22} color={theme.colors.hero.primary} />
                                    <Text style={styles.selectedEmptyTitle}>No games added yet</Text>
                                    <Text style={styles.selectedEmptyCopy}>Search above to start building the lineup for this list.</Text>
                                </View>
                            ) : (
                                <View style={styles.selectedList}>
                                    {selectedGames.map((game, index) => (
                                        <View key={`${game.id}-${index}`} style={styles.selectedGameRow}>
                                            {game.coverUrl ? (
                                                <Image source={{ uri: game.coverUrl }} style={styles.selectedGameCover} contentFit="cover" transition={150} />
                                            ) : (
                                                <View style={styles.selectedGamePlaceholder}>
                                                    <Ionicons name="game-controller" size={18} color={theme.colors.text.muted} />
                                                </View>
                                            )}

                                            <View style={styles.selectedGameInfo}>
                                                <Text style={styles.selectedGameTitle}>{game.title}</Text>
                                                {game.releaseDate ? (
                                                    <Text style={styles.selectedGameMeta}>{new Date(game.releaseDate).getFullYear()}</Text>
                                                ) : null}
                                            </View>

                                            <View style={styles.selectedGameActions}>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, index === 0 && styles.iconButtonDisabled]}
                                                    onPress={() => moveSelectedGame(index, -1)}
                                                    disabled={index === 0}
                                                >
                                                    <Ionicons name="chevron-up" size={16} color={theme.colors.text.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.iconButton, index === selectedGames.length - 1 && styles.iconButtonDisabled]}
                                                    onPress={() => moveSelectedGame(index, 1)}
                                                    disabled={index === selectedGames.length - 1}
                                                >
                                                    <Ionicons name="chevron-down" size={16} color={theme.colors.text.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.removeButton}
                                                    onPress={() => setSelectedGames((current) => current.filter((selected) => selected.id !== game.id))}
                                                >
                                                    <Ionicons name="close" size={16} color={theme.colors.hero.tertiary} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {saveMutation.isError ? (
                                <Text style={styles.errorText}>{(saveMutation.error as Error)?.message}</Text>
                            ) : null}

                            {editingList ? (
                                <View style={styles.deleteSection}>
                                    <Text style={styles.deleteTitle}>Delete this list</Text>
                                    <Text style={styles.deleteCopy}>This removes the list and every game attached to it from the shelf.</Text>

                                    {confirmDelete ? (
                                        <View style={styles.deleteActions}>
                                            <TouchableOpacity style={styles.secondaryDeleteButton} onPress={() => setConfirmDelete(false)}>
                                                <Text style={styles.secondaryDeleteText}>Keep List</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.primaryDeleteButton}
                                                onPress={() => deleteMutation.mutate()}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Text style={styles.primaryDeleteText}>
                                                    {deleteMutation.isPending ? 'Deleting...' : 'Delete List'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.deleteTrigger} onPress={() => setConfirmDelete(true)}>
                                            <Ionicons name="trash-outline" size={16} color={theme.colors.hero.tertiary} />
                                            <Text style={styles.deleteTriggerText}>Delete List</Text>
                                        </TouchableOpacity>
                                    )}

                                    {deleteMutation.isError ? (
                                        <Text style={styles.errorText}>{(deleteMutation.error as Error)?.message}</Text>
                                    ) : null}
                                </View>
                            ) : null}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme']) => StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    heroCard: {
        marginHorizontal: 20,
        marginTop: 18,
        borderRadius: 30,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
    },
    heroLabel: {
        color: theme.colors.white,
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroNumber: {
        marginTop: 8,
        color: theme.colors.white,
        fontSize: 46,
        lineHeight: 48,
        fontFamily: 'Inter_700Bold',
    },
    heroCopy: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.82)',
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
    },
    heroButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: theme.isDark ? 'rgba(34, 21, 14, 0.86)' : 'rgba(255, 249, 242, 0.92)',
        borderWidth: 1,
        borderColor: theme.isDark ? 'rgba(255, 243, 229, 0.18)' : 'rgba(141, 80, 55, 0.12)',
    },
    heroButtonText: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.isDark ? theme.colors.white : theme.colors.text.primary,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyCard: {
        marginHorizontal: 20,
        marginTop: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 28,
        alignItems: 'center',
    },
    emptyTitle: {
        marginTop: 14,
        fontSize: 21,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    emptyCopy: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        textAlign: 'center',
    },
    emptyButton: {
        marginTop: 18,
        borderRadius: 999,
        backgroundColor: `${theme.colors.hero.primary}20`,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    emptyButtonText: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.primary,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 130,
        gap: 12,
    },
    listCard: {
        borderRadius: 28,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 18,
        overflow: 'hidden',
    },
    listCardHeader: {
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
    },
    listIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${theme.colors.hero.primary}16`,
    },
    listCardInfo: {
        flex: 1,
    },
    listTitle: {
        fontSize: 18,
        lineHeight: 22,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    listSubtitle: {
        marginTop: 4,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    listDescription: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    previewRow: {
        marginTop: 16,
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
    },
    previewCover: {
        width: 42,
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.bg.secondary,
    },
    previewPlaceholder: {
        width: 42,
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.bg.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewCoverOverlap: {
        marginLeft: -8,
    },
    emptyPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: `${theme.colors.hero.primary}12`,
    },
    emptyPreviewText: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    listMetaRow: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: theme.colors.bg.secondary,
    },
    metaText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
    },
    publicPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: theme.isDark ? `${theme.colors.hero.quaternary}18` : `${theme.colors.hero.secondary}12`,
        borderWidth: 1,
        borderColor: theme.isDark ? `${theme.colors.hero.quaternary}20` : `${theme.colors.hero.secondary}28`,
    },
    privatePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: theme.colors.bg.secondary,
    },
    publicText: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: theme.isDark ? theme.colors.hero.quaternary : theme.colors.hero.tertiary,
    },
    privateText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
    },
    editLabel: {
        marginLeft: 'auto',
        fontSize: 11,
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    modalAction: {
        fontSize: 15,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.secondary,
    },
    modalActionStrong: {
        fontSize: 15,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.primary,
    },
    disabledText: {
        opacity: 0.45,
    },
    modalTitle: {
        fontSize: 15,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    modalBody: {
        padding: 20,
        gap: 18,
        paddingBottom: 48,
    },
    modalHero: {
        borderRadius: 24,
        padding: 18,
    },
    modalHeroTitle: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    modalHeroCopy: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    fieldBlock: {
        gap: 10,
    },
    fieldLabel: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    input: {
        minHeight: 56,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
        backgroundColor: theme.colors.surface.glassStrong,
        color: theme.colors.text.primary,
        paddingHorizontal: 16,
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
    },
    textArea: {
        minHeight: 128,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
        backgroundColor: theme.colors.surface.glassStrong,
        color: theme.colors.text.primary,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 18,
    },
    toggleTextWrap: {
        flex: 1,
    },
    toggleTitle: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },
    toggleCopy: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    gamesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gamesCount: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
    },
    helperText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    searchResults: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        overflow: 'hidden',
    },
    searchSpinner: {
        paddingVertical: 20,
    },
    noResultsText: {
        padding: 16,
        textAlign: 'center',
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    searchResultRowLast: {
        borderBottomWidth: 0,
    },
    searchResultTitle: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.primary,
    },
    searchResultYear: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    selectedEmpty: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 24,
        alignItems: 'center',
    },
    selectedEmptyTitle: {
        marginTop: 10,
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    selectedEmptyCopy: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        textAlign: 'center',
    },
    selectedList: {
        gap: 10,
    },
    selectedGameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 12,
    },
    selectedGameCover: {
        width: 44,
        height: 60,
        borderRadius: 12,
    },
    selectedGamePlaceholder: {
        width: 44,
        height: 60,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg.secondary,
    },
    selectedGameInfo: {
        flex: 1,
        gap: 4,
    },
    selectedGameTitle: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    selectedGameMeta: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    selectedGameActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg.secondary,
    },
    iconButtonDisabled: {
        opacity: 0.35,
    },
    removeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${theme.colors.hero.tertiary}14`,
    },
    errorText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.hero.tertiary,
    },
    deleteSection: {
        marginTop: 8,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        gap: 10,
    },
    deleteTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    deleteCopy: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    deleteTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.hero.tertiary,
        paddingVertical: 12,
    },
    deleteTriggerText: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.tertiary,
    },
    deleteActions: {
        flexDirection: 'row',
        gap: 10,
    },
    secondaryDeleteButton: {
        flex: 1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    secondaryDeleteText: {
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
    },
    primaryDeleteButton: {
        flex: 1,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: theme.colors.hero.tertiary,
    },
    primaryDeleteText: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.white,
    },
});
