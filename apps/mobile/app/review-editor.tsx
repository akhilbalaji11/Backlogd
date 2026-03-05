import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StarRating } from '../src/components/ui/StarRating';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { colors, radius, spacing, typography } from '../src/styles/tokens';

export default function ReviewEditorScreen() {
    const { gameId, gameTitle } = useLocalSearchParams<{ gameId: string; gameTitle: string }>();
    const router = useRouter();
    const { user } = useAuthStore();
    const qc = useQueryClient();

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [spoiler, setSpoiler] = useState(false);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!user || !gameId) throw new Error('Not authenticated');
            if (rating === 0) throw new Error('Please select a rating');

            const { error } = await supabase.from('reviews').upsert({
                user_id: user.id,
                game_id: gameId,
                rating,
                review_text: reviewText.trim() || null,
                spoiler,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,game_id' });
            if (error) throw error;

            // Write activity event
            await supabase.from('activity_events').insert({
                actor_id: user.id,
                type: reviewText.trim() ? 'review' : 'rating',
                entity_id: gameId,
                metadata: {
                    game_title: gameTitle,
                    rating,
                    review_preview: reviewText.trim().slice(0, 100),
                },
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['game-detail', gameId] });
            qc.invalidateQueries({ queryKey: ['reviews', gameId] });
            router.back();
        },
        onError: (err: Error) => Alert.alert('Error', err.message),
    });

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Ionicons name="close" size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Review</Text>
                        <TouchableOpacity
                            onPress={() => mutation.mutate()}
                            disabled={mutation.isPending || rating === 0}
                        >
                            <Text style={[styles.saveBtn, (mutation.isPending || rating === 0) && styles.saveBtnDisabled]}>
                                {mutation.isPending ? 'Saving…' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.gameTitle}>{gameTitle}</Text>

                    {/* Star rating */}
                    <View style={styles.ratingSection}>
                        <Text style={styles.label}>Your Rating</Text>
                        <StarRating value={rating} onChange={setRating} size={36} />
                        {rating === 0 && <Text style={styles.hint}>Tap a star to rate (required)</Text>}
                    </View>

                    {/* Review text */}
                    <View style={styles.textSection}>
                        <Text style={styles.label}>Review (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Share your thoughts…"
                            placeholderTextColor={colors.text.muted}
                            value={reviewText}
                            onChangeText={setReviewText}
                            multiline
                            numberOfLines={8}
                            textAlignVertical="top"
                            selectionColor={colors.purple[400]}
                        />
                        <Text style={styles.charCount}>{reviewText.length} / 2000</Text>
                    </View>

                    {/* Spoiler toggle */}
                    <View style={styles.spoilerRow}>
                        <View>
                            <Text style={styles.spoilerLabel}>Contains Spoilers</Text>
                            <Text style={styles.spoilerDesc}>Blur review for others until tapped</Text>
                        </View>
                        <Switch
                            value={spoiler}
                            onValueChange={setSpoiler}
                            trackColor={{ false: colors.border, true: colors.purple[600] }}
                            thumbColor={colors.white}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base },
    headerTitle: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    saveBtn: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.purple[400] },
    saveBtnDisabled: { opacity: 0.4 },
    gameTitle: { fontSize: typography.size.xl, fontFamily: 'Inter_700Bold', color: colors.text.primary, marginBottom: spacing.xl },
    ratingSection: { gap: spacing.sm, marginBottom: spacing.xl },
    label: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    hint: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.muted },
    textSection: { gap: spacing.sm, marginBottom: spacing.lg },
    textInput: {
        backgroundColor: colors.bg.secondary,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        padding: spacing.base,
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: colors.text.primary,
        minHeight: 160,
    },
    charCount: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.muted, textAlign: 'right' },
    spoilerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bg.card, borderRadius: radius.md,
        padding: spacing.base, borderWidth: 1, borderColor: colors.border,
    },
    spoilerLabel: { fontSize: typography.size.base, fontFamily: 'Inter_500Medium', color: colors.text.primary },
    spoilerDesc: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary, marginTop: 2 },
});
