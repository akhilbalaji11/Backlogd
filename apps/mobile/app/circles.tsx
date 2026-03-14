import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeBackdrop } from '../src/components/ui/ThemeBackdrop';
import { socialApi } from '../src/lib/api';
import { useAppTheme } from '../src/theme/appTheme';

export default function CirclesScreen() {
    const { theme } = useAppTheme();
    const queryClient = useQueryClient();
    const [newCircleName, setNewCircleName] = useState('');
    const [newChallengeTitle, setNewChallengeTitle] = useState('');

    const { data: circles = [] } = useQuery({
        queryKey: ['social-circles'],
        queryFn: async () => {
            const { results } = await socialApi.circleAction({ action: 'list_my_circles' });
            return results ?? [];
        },
    });

    const createCircle = useMutation({
        mutationFn: async () => {
            if (!newCircleName.trim()) {
                throw new Error('Circle name is required.');
            }
            return socialApi.circleAction({
                action: 'create_circle',
                name: newCircleName.trim(),
                visibility: 'private',
            });
        },
        onSuccess: async () => {
            setNewCircleName('');
            await queryClient.invalidateQueries({ queryKey: ['social-circles'] });
        },
        onError: (error: any) => {
            Alert.alert('Could not create circle', error?.message ?? 'Try again.');
        },
    });

    const createChallenge = useMutation({
        mutationFn: async () => {
            if (circles.length === 0) throw new Error('Create a circle first.');
            if (!newChallengeTitle.trim()) throw new Error('Challenge title is required.');

            const firstCircle = circles[0];
            return socialApi.circleAction({
                action: 'create_challenge',
                circleId: firstCircle.id,
                title: newChallengeTitle.trim(),
                goalType: 'finish_count',
                goalTarget: 3,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0],
            });
        },
        onSuccess: () => {
            setNewChallengeTitle('');
            Alert.alert('Challenge created', 'Your circle challenge is now live.');
        },
        onError: (error: any) => {
            Alert.alert('Could not create challenge', error?.message ?? 'Try again.');
        },
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.title, { color: theme.colors.text.primary }]}>Backlog Parties</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                        Build private circles with friends and create seasonal finish quests.
                    </Text>

                    <View style={[styles.card, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Create circle</Text>
                        <TextInput
                            value={newCircleName}
                            onChangeText={setNewCircleName}
                            placeholder="Weekend RPG Squad"
                            placeholderTextColor={theme.colors.text.muted}
                            style={[styles.input, { color: theme.colors.text.primary, borderColor: theme.colors.border }]}
                        />
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.colors.hero.secondary }]}
                            onPress={() => createCircle.mutate()}
                            disabled={createCircle.isPending}
                        >
                            <Text style={styles.buttonText}>{createCircle.isPending ? 'Creating...' : 'Create Circle'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.card, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                        <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>Quick challenge</Text>
                        <Text style={[styles.cardHint, { color: theme.colors.text.secondary }]}>
                            Creates a 30-day “finish 3 games” challenge in your first circle.
                        </Text>
                        <TextInput
                            value={newChallengeTitle}
                            onChangeText={setNewChallengeTitle}
                            placeholder="Spring backlog sprint"
                            placeholderTextColor={theme.colors.text.muted}
                            style={[styles.input, { color: theme.colors.text.primary, borderColor: theme.colors.border }]}
                        />
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.colors.hero.primary }]}
                            onPress={() => createChallenge.mutate()}
                            disabled={createChallenge.isPending}
                        >
                            <Text style={styles.buttonText}>{createChallenge.isPending ? 'Creating...' : 'Create Challenge'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.stack}>
                        {circles.length === 0 ? (
                            <View style={[styles.emptyCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface.glassStrong }]}>
                                <Ionicons name="people-outline" size={22} color={theme.colors.text.muted} />
                                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No circles yet</Text>
                                <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
                                    Create one above and invite friends to start a backlog party.
                                </Text>
                            </View>
                        ) : circles.map((circle: any) => (
                            <View key={circle.id} style={[styles.circleRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface.glassStrong }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.circleTitle, { color: theme.colors.text.primary }]}>{circle.name}</Text>
                                    <Text style={[styles.circleMeta, { color: theme.colors.text.secondary }]}>{circle.visibility} circle</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.text.muted} />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scroll: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
    title: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
    subtitle: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 6 },
    card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
    cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
    cardHint: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
    },
    button: {
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontFamily: 'Inter_700Bold',
        fontSize: 13,
    },
    stack: { gap: 10, marginTop: 8 },
    emptyCard: { borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
    emptyTitle: { marginTop: 8, fontSize: 16, fontFamily: 'Inter_700Bold' },
    emptySubtitle: { marginTop: 6, fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: 'Inter_400Regular' },
    circleRow: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    circleTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
    circleMeta: { marginTop: 4, fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
});
