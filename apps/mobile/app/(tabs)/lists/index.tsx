import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
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
import type { GameList } from '../../../src/domain/types';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, radius, spacing, typography } from '../../../src/styles/tokens';

export default function ListsScreen() {
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const router = useRouter();
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    const { data: lists = [], isLoading } = useQuery<GameList[]>({
        queryKey: ['lists', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('lists')
                .select('*, item_count:list_items(count)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data ?? []).map((l) => ({
                id: l.id,
                userId: l.user_id,
                title: l.title,
                description: l.description,
                isPublic: l.is_public,
                createdAt: l.created_at,
                updatedAt: l.updated_at,
                itemCount: Array.isArray(l.item_count) ? l.item_count[0]?.count ?? 0 : 0,
            }));
        },
        enabled: !!user,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!user || !newTitle.trim()) throw new Error('Title is required');
            const { error } = await supabase.from('lists').insert({
                user_id: user.id,
                title: newTitle.trim(),
                description: newDesc.trim() || null,
                is_public: isPublic,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lists', user?.id] });
            setShowCreate(false);
            setNewTitle('');
            setNewDesc('');
        },
        onError: (e: Error) => {
            console.error('[Lists] create error:', e);
            Alert.alert('Could not create list', e.message);
        },
    });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Lists</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
                    <Ionicons name="add" size={22} color={colors.white} />
                </TouchableOpacity>
            </View>

            {lists.length === 0 && !isLoading ? (
                <View style={styles.emptyState}>
                    <Ionicons name="list-outline" size={56} color={colors.text.muted} />
                    <Text style={styles.emptyTitle}>No lists yet</Text>
                    <Text style={styles.emptyMsg}>Create curated collections like "Best Indie Games"</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
                        <Text style={styles.createBtnText}>Create a List</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={lists}
                    keyExtractor={(l) => l.id}
                    contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.listCard} activeOpacity={0.8}>
                            <View style={styles.listCardInfo}>
                                <Text style={styles.listTitle}>{item.title}</Text>
                                {item.description ? <Text style={styles.listDesc} numberOfLines={1}>{item.description}</Text> : null}
                                <View style={styles.listMeta}>
                                    <Text style={styles.listMetaText}>{item.itemCount} games</Text>
                                    {!item.isPublic && (
                                        <View style={styles.privateChip}>
                                            <Ionicons name="lock-closed" size={10} color={colors.text.muted} />
                                            <Text style={styles.privateText}>Private</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Create List Modal */}
            <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
                <SafeAreaView style={styles.modal}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCreate(false)}>
                            <Text style={styles.cancelBtn}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>New List</Text>
                        <TouchableOpacity onPress={() => createMutation.mutate()} disabled={createMutation.isPending || !newTitle.trim()}>
                            <Text style={[styles.modalSave, (!newTitle.trim()) && { opacity: 0.4 }]}>Create</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="List title"
                            placeholderTextColor={colors.text.muted}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            selectionColor={colors.purple[400]}
                            autoFocus
                        />
                        <TextInput
                            style={[styles.modalInput, { height: 100 }]}
                            placeholder="Description (optional)"
                            placeholderTextColor={colors.text.muted}
                            value={newDesc}
                            onChangeText={setNewDesc}
                            multiline
                            textAlignVertical="top"
                            selectionColor={colors.purple[400]}
                        />
                        <View style={styles.publicRow}>
                            <Text style={styles.publicLabel}>Public list</Text>
                            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: colors.border, true: colors.purple[600] }} thumbColor={colors.white} />
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: typography.size['2xl'], fontFamily: 'Inter_700Bold', color: colors.text.primary },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.purple[600], alignItems: 'center', justifyContent: 'center' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    emptyTitle: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    emptyMsg: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textAlign: 'center', maxWidth: 280 },
    createBtn: { backgroundColor: colors.purple[600], borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
    createBtnText: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.white },
    listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.base, borderWidth: 1, borderColor: colors.border },
    listCardInfo: { flex: 1, gap: 4 },
    listTitle: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    listDesc: { fontSize: typography.size.sm, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    listMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
    listMetaText: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.muted },
    privateChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.bg.tertiary, paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.full },
    privateText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.text.muted },
    modal: { flex: 1, backgroundColor: colors.bg.primary },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border },
    cancelBtn: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    modalTitle: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    modalSave: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.purple[400] },
    modalBody: { padding: spacing.lg, gap: spacing.base },
    modalInput: { backgroundColor: colors.bg.secondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.base, fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.primary, minHeight: 52 },
    publicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.base, borderWidth: 1, borderColor: colors.border },
    publicLabel: { fontSize: typography.size.base, fontFamily: 'Inter_500Medium', color: colors.text.primary },
});
