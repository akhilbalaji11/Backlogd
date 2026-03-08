import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { GameList } from '../../../src/domain/types';
import { supabase } from '../../../src/lib/supabase';
import { withTimeout } from '../../../src/lib/withTimeout';
import { useAuthStore } from '../../../src/stores/authStore';
import { useAppTheme } from '../../../src/theme/appTheme';

function ListCard({ list }: { list: GameList }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    return (
        <TouchableOpacity
            activeOpacity={0.92}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.985, useNativeDriver: true, friction: 8 }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
        >
            <Animated.View style={[styles.listCard, { transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient
                    colors={[`${theme.colors.hero.primary}26`, `${theme.colors.hero.secondary}14`, 'transparent']}
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
                        <Text style={styles.listDescription} numberOfLines={2}>
                            {list.description || 'A curated shelf waiting for more games.'}
                        </Text>
                    </View>
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
                            color={list.isPublic ? theme.colors.hero.quaternary : theme.colors.text.secondary}
                        />
                        <Text style={list.isPublic ? styles.publicText : styles.privateText}>
                            {list.isPublic ? 'Public' : 'Private'}
                        </Text>
                    </View>
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
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    const { data: lists = [], isLoading } = useQuery<GameList[]>({
        queryKey: ['lists', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('lists')
                    .select('*, item_count:list_items(count)')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false }),
                8_000,
                'Load lists'
            );
            if (error) throw error;
            return (data ?? []).map((list) => ({
                id: list.id,
                userId: list.user_id,
                title: list.title,
                description: list.description,
                isPublic: list.is_public,
                createdAt: list.created_at,
                updatedAt: list.updated_at,
                itemCount: Array.isArray(list.item_count) ? list.item_count[0]?.count ?? 0 : 0,
            }));
        },
        enabled: !!user,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!user || !newTitle.trim()) throw new Error('Title is required');
            const { error } = await withTimeout(
                supabase.from('lists').insert({
                    user_id: user.id,
                    title: newTitle.trim(),
                    description: newDesc.trim() || null,
                    is_public: isPublic,
                }),
                8_000,
                'Create list'
            );
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lists', user?.id] });
            qc.invalidateQueries({ queryKey: ['profile-lists', user?.id] });
            setShowCreate(false);
            setNewTitle('');
            setNewDesc('');
            setIsPublic(true);
        },
        onError: (error: Error) => Alert.alert('Error', error.message),
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <Text style={styles.kicker}>Curated Shelves</Text>
                        <Text style={styles.title}>Lists</Text>
                        <Text style={styles.subtitle}>Build colorful collections instead of dumping everything into one backlog.</Text>
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
                    <TouchableOpacity style={styles.heroButton} onPress={() => setShowCreate(true)} activeOpacity={0.9}>
                        <Ionicons name="add" size={18} color={theme.colors.text.primary} />
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
                            Start with a mood board like "Best handheld comfort games" or "Brutal bosses worth replaying."
                        </Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={() => setShowCreate(true)} activeOpacity={0.88}>
                            <Text style={styles.emptyButtonText}>Create your first list</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={lists}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <ListCard list={item} />}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
                    <SafeAreaView style={[styles.modal, { backgroundColor: theme.colors.bg.primary }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowCreate(false)}>
                                <Text style={styles.modalAction}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>New List</Text>
                            <TouchableOpacity onPress={() => createMutation.mutate()} disabled={createMutation.isPending || !newTitle.trim()}>
                                <Text style={[styles.modalActionStrong, (createMutation.isPending || !newTitle.trim()) && styles.disabledText]}>
                                    {createMutation.isPending ? 'Creating...' : 'Create'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <LinearGradient
                                colors={[`${theme.colors.hero.primary}24`, `${theme.colors.hero.secondary}18`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalHero}
                            >
                                <Text style={styles.modalHeroTitle}>Design the shelf</Text>
                                <Text style={styles.modalHeroCopy}>Give the list a strong name and a short angle so people know what makes it worth opening.</Text>
                            </LinearGradient>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Title</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Best RPGs for long weekends"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={newTitle}
                                    onChangeText={setNewTitle}
                                    selectionColor={theme.colors.hero.primary}
                                    autoFocus
                                />
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Description</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="What is this collection trying to capture?"
                                    placeholderTextColor={theme.colors.text.muted}
                                    value={newDesc}
                                    onChangeText={setNewDesc}
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
                        </View>
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
    kicker: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.neon.orange,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    title: {
        marginTop: 6,
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
        maxWidth: 290,
    },
    heroCard: {
        marginHorizontal: 20,
        marginTop: 18,
        borderRadius: 30,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
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
        backgroundColor: 'rgba(255,255,255,0.82)',
    },
    heroButtonText: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
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
    listDescription: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    listMetaRow: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
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
        backgroundColor: `${theme.colors.hero.quaternary}16`,
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
        color: theme.colors.hero.quaternary,
    },
    privateText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
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
});
