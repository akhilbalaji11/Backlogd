// Diary tab screen — timeline of play sessions + add session button
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PlaySession } from '../../../src/domain/types';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, radius, spacing, typography } from '../../../src/styles/tokens';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function DiaryScreen() {
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [gameTitle, setGameTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [platform, setPlatform] = useState('');
    const [minutes, setMinutes] = useState('');

    const { data: sessions = [], isLoading } = useQuery<PlaySession[]>({
        queryKey: ['play-sessions', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('play_sessions')
                .select('*, game:games(title, cover_url)')
                .eq('user_id', user.id)
                .order('played_on', { ascending: false });
            if (error) {
                console.warn('[Diary] sessions error:', error.message);
                return [];
            }
            return (data ?? []).map((s) => ({
                id: s.id,
                userId: s.user_id,
                gameId: s.game_id,
                playedOn: s.played_on,
                minutes: s.minutes,
                platform: s.platform,
                notes: s.notes,
                createdAt: s.created_at,
                game: s.game ? { title: s.game.title, coverUrl: s.game.cover_url } : undefined,
            }));
        },
        enabled: !!user,
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('Not signed in');
            if (!gameTitle.trim()) throw new Error('Game title is required');

            // Look up or create a stub game record
            let gameId: string | null = null;
            const { data: existingGames } = await supabase
                .from('games')
                .select('id')
                .ilike('title', gameTitle.trim())
                .limit(1);
            if (existingGames && existingGames.length > 0) {
                gameId = existingGames[0].id;
            } else {
                const { data: newGame, error: gameErr } = await supabase
                    .from('games')
                    .insert({
                        provider: 'manual',
                        provider_game_id: `manual_${Date.now()}`,
                        title: gameTitle.trim(),
                        genres: [],
                        platforms: [],
                        themes: [],
                        similar_game_ids: [],
                    })
                    .select('id')
                    .single();
                if (gameErr) throw gameErr;
                gameId = newGame.id;
            }

            const { error } = await supabase.from('play_sessions').insert({
                user_id: user.id,
                game_id: gameId,
                played_on: new Date().toISOString().split('T')[0],
                minutes: minutes ? parseInt(minutes, 10) : null,
                platform: platform.trim() || null,
                notes: notes.trim() || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['play-sessions', user?.id] });
            setShowAdd(false);
            setGameTitle('');
            setNotes('');
            setPlatform('');
            setMinutes('');
        },
        onError: (e: Error) => {
            console.error('[Diary] add session error:', e);
            Alert.alert('Error', e.message);
        },
    });

    const grouped = groupByMonth(sessions);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Diary</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
                    <Ionicons name="add" size={22} color={colors.white} />
                </TouchableOpacity>
            </View>

            {sessions.length === 0 && !isLoading ? (
                <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={56} color={colors.text.muted} />
                    <Text style={styles.emptyTitle}>No sessions logged</Text>
                    <Text style={styles.emptyMessage}>Tap + to log a gaming session</Text>
                </View>
            ) : (
                <FlatList
                    data={grouped}
                    keyExtractor={([month]) => month}
                    contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
                    renderItem={({ item: [month, slist] }) => (
                        <View>
                            <Text style={styles.monthLabel}>{month}</Text>
                            <View style={{ gap: spacing.sm }}>
                                {slist.map((session) => (
                                    <SessionCard key={session.id} session={session} />
                                ))}
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Add Session Modal */}
            <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
                <SafeAreaView style={styles.modal}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowAdd(false)}>
                            <Text style={styles.cancelBtn}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Log Session</Text>
                        <TouchableOpacity
                            onPress={() => addMutation.mutate()}
                            disabled={addMutation.isPending || !gameTitle.trim()}
                        >
                            <Text style={[styles.saveBtn, (!gameTitle.trim() || addMutation.isPending) && { opacity: 0.4 }]}>
                                {addMutation.isPending ? 'Saving…' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        <Text style={styles.fieldLabel}>Game Title *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Elden Ring"
                            placeholderTextColor={colors.text.muted}
                            value={gameTitle}
                            onChangeText={setGameTitle}
                            selectionColor={colors.purple[400]}
                            autoFocus
                        />

                        <Text style={styles.fieldLabel}>Platform</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. PS5, PC, Switch"
                            placeholderTextColor={colors.text.muted}
                            value={platform}
                            onChangeText={setPlatform}
                            selectionColor={colors.purple[400]}
                        />

                        <Text style={styles.fieldLabel}>Time Played (minutes)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 90"
                            placeholderTextColor={colors.text.muted}
                            value={minutes}
                            onChangeText={setMinutes}
                            keyboardType="numeric"
                            selectionColor={colors.purple[400]}
                        />

                        <Text style={styles.fieldLabel}>Notes (optional)</Text>
                        <TextInput
                            style={[styles.input, { height: 100 }]}
                            placeholder="What happened in this session?"
                            placeholderTextColor={colors.text.muted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            textAlignVertical="top"
                            selectionColor={colors.purple[400]}
                        />
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

function SessionCard({ session }: { session: PlaySession }) {
    return (
        <View style={styles.sessionCard}>
            <View style={styles.sessionRow}>
                <View style={styles.sessionDot} />
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionGame}>{session.game?.title ?? 'Unknown Game'}</Text>
                    <Text style={styles.sessionDate}>{formatDate(session.playedOn)}</Text>
                    {session.platform && <Text style={styles.sessionMeta}>📱 {session.platform}</Text>}
                    {session.minutes && (
                        <Text style={styles.sessionMeta}>
                            ⏱ {Math.floor(session.minutes / 60)}h {session.minutes % 60}m
                        </Text>
                    )}
                    {session.notes && <Text style={styles.sessionNotes} numberOfLines={2}>{session.notes}</Text>}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: typography.size['2xl'], fontFamily: 'Inter_700Bold', color: colors.text.primary },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.purple[600], alignItems: 'center', justifyContent: 'center' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    emptyTitle: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    emptyMessage: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textAlign: 'center' },
    monthLabel: { fontSize: typography.size.base, fontFamily: 'Inter_700Bold', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
    sessionCard: { backgroundColor: colors.bg.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    sessionRow: { flexDirection: 'row', gap: spacing.md },
    sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.purple[500], marginTop: 6 },
    sessionInfo: { flex: 1, gap: 4 },
    sessionGame: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    sessionDate: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    sessionMeta: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    sessionNotes: { fontSize: typography.size.sm, fontFamily: 'Inter_400Regular', color: colors.text.muted, fontStyle: 'italic' },
    // Modal
    modal: { flex: 1, backgroundColor: colors.bg.primary },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border },
    cancelBtn: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    modalTitle: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    saveBtn: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.purple[400] },
    modalBody: { padding: spacing.lg, gap: spacing.sm },
    fieldLabel: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: colors.bg.secondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.base, fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.primary, minHeight: 52 },
});
