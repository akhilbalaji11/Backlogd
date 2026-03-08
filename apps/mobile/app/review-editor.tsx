import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
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

import { StarRating } from '../src/components/ui/StarRating';
import { ThemeBackdrop } from '../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../src/components/ui/ThemeModeToggle';
import { supabase } from '../src/lib/supabase';
import { withTimeout } from '../src/lib/withTimeout';
import { useAuthStore } from '../src/stores/authStore';
import { useAppTheme } from '../src/theme/appTheme';

export default function ReviewEditorScreen() {
    const { gameId, gameTitle } = useLocalSearchParams<{ gameId: string; gameTitle: string }>();
    const router = useRouter();
    const { user } = useAuthStore();
    const qc = useQueryClient();
    const { theme } = useAppTheme();
    const styles = createStyles(theme);

    const [rating, setRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [spoiler, setSpoiler] = useState(false);
    const hydratedRef = useRef(false);

    const { data: existingReview } = useQuery({
        queryKey: ['game-user-review', user?.id, gameId],
        queryFn: async () => {
            if (!user || !gameId) return null;
            const { data, error } = await withTimeout(
                supabase
                    .from('reviews')
                    .select('rating, review_text, spoiler')
                    .eq('user_id', user.id)
                    .eq('game_id', gameId)
                    .maybeSingle(),
                8_000,
                'Load existing review'
            );
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!gameId,
        staleTime: 1000 * 30,
    });

    useEffect(() => {
        if (hydratedRef.current || !existingReview) return;
        setRating(Number(existingReview.rating ?? 0));
        setReviewText(existingReview.review_text ?? '');
        setSpoiler(existingReview.spoiler ?? false);
        hydratedRef.current = true;
    }, [existingReview]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!user || !gameId) throw new Error('Not authenticated');
            if (rating === 0) throw new Error('Please select a rating');

            const { error } = await withTimeout(
                supabase.from('reviews').upsert({
                    user_id: user.id,
                    game_id: gameId,
                    rating,
                    review_text: reviewText.trim() || null,
                    spoiler,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,game_id' }),
                8_000,
                'Save review'
            );
            if (error) throw error;

            const { error: activityError } = await withTimeout(
                supabase.from('activity_events').insert({
                    actor_id: user.id,
                    type: reviewText.trim() ? 'review' : 'rating',
                    entity_id: gameId,
                    metadata: {
                        game_title: gameTitle,
                        rating,
                        review_preview: reviewText.trim().slice(0, 100),
                    },
                }),
                8_000,
                'Create review activity event'
            );
            if (activityError) {
                console.warn('[Review Editor] activity event error:', activityError.message);
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['game-detail', gameId] });
            qc.invalidateQueries({ queryKey: ['game-user-activity', user?.id, gameId] });
            qc.invalidateQueries({ queryKey: ['game-user-review', user?.id, gameId] });
            qc.invalidateQueries({ queryKey: ['reviews', gameId] });
            qc.invalidateQueries({ queryKey: ['profile-reviews', user?.id] });
            qc.invalidateQueries({ queryKey: ['profile-stats', user?.id] });
            router.back();
        },
        onError: (err: Error) => Alert.alert('Error', err.message),
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <View style={styles.topRow}>
                            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
                                <Ionicons name="close" size={20} color={theme.colors.text.primary} />
                            </TouchableOpacity>
                            <ThemeModeToggle compact />
                        </View>

                        <LinearGradient
                            colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroCard}
                        >
                            <Text style={styles.heroEyebrow}>Review Bay</Text>
                            <Text style={styles.heroTitle} numberOfLines={2}>{gameTitle}</Text>
                            <Text style={styles.heroCopy}>
                                Drop a score, write the post-match analysis, and decide whether the review needs spoiler shielding.
                            </Text>
                        </LinearGradient>

                        <View style={styles.panel}>
                            <View style={styles.panelHeader}>
                                <View>
                                    <Text style={styles.sectionLabel}>Your Rating</Text>
                                    <Text style={styles.sectionCopy}>Tap or drag across the stars to set your score.</Text>
                                </View>
                                {rating > 0 && (
                                    <View style={styles.ratingBadge}>
                                        <Ionicons name="sparkles" size={12} color={theme.colors.white} />
                                        <Text style={styles.ratingBadgeText}>{rating.toFixed(1)}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.ratingPanel}>
                                <StarRating value={rating} onChange={setRating} size={42} />
                            </View>
                            {rating === 0 && <Text style={styles.hint}>A rating is required before you can save.</Text>}
                        </View>

                        <View style={styles.panel}>
                            <View style={styles.textHeader}>
                                <View>
                                    <Text style={styles.sectionLabel}>Review Notes</Text>
                                    <Text style={styles.sectionCopy}>Keep it punchy or go long form. Either way, make it readable.</Text>
                                </View>
                                <Text style={styles.charCount}>{reviewText.length} / 2000</Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="What landed, what missed, and what the game is really doing..."
                                placeholderTextColor={theme.colors.text.muted}
                                value={reviewText}
                                onChangeText={setReviewText}
                                multiline
                                numberOfLines={9}
                                textAlignVertical="top"
                                selectionColor={theme.colors.hero.secondary}
                                maxLength={2000}
                            />
                        </View>

                        <View style={styles.toggleCard}>
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleTitle}>Contains spoilers</Text>
                                <Text style={styles.toggleCopy}>Blur the write-up until someone chooses to reveal it.</Text>
                            </View>
                            <Switch
                                value={spoiler}
                                onValueChange={setSpoiler}
                                trackColor={{ false: theme.colors.border, true: theme.colors.hero.secondary }}
                                thumbColor={theme.colors.white}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, mutation.isPending || rating === 0 ? styles.saveButtonDisabled : null]}
                            onPress={() => mutation.mutate()}
                            disabled={mutation.isPending || rating === 0}
                            activeOpacity={0.88}
                        >
                            <LinearGradient
                                colors={[theme.colors.hero.primary, theme.colors.hero.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.saveGradient}
                            >
                                <Ionicons name="send" size={16} color={theme.colors.white} />
                                <Text style={styles.saveText}>{mutation.isPending ? 'Saving...' : 'Publish Review'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme']) => StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 120,
        gap: 16,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface.glassStrong,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    heroCard: {
        borderRadius: 30,
        padding: 24,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 10,
    },
    heroEyebrow: {
        color: theme.colors.white,
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroTitle: {
        marginTop: 12,
        color: theme.colors.white,
        fontSize: 31,
        lineHeight: 35,
        fontFamily: 'Inter_700Bold',
    },
    heroCopy: {
        marginTop: 10,
        color: 'rgba(255,255,255,0.86)',
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
        maxWidth: 320,
    },
    panel: {
        borderRadius: 28,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 20,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 6,
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 14,
    },
    sectionLabel: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sectionCopy: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: `${theme.colors.hero.secondary}25`,
    },
    ratingBadgeText: {
        color: theme.colors.white,
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
    },
    ratingPanel: {
        marginTop: 18,
        paddingVertical: 8,
    },
    hint: {
        marginTop: 10,
        fontSize: 12,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.hero.tertiary,
    },
    textHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
    },
    charCount: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.muted,
        alignSelf: 'flex-start',
    },
    textInput: {
        minHeight: 210,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
        backgroundColor: theme.colors.bg.secondary,
        color: theme.colors.text.primary,
        padding: 18,
        fontSize: 15,
        lineHeight: 24,
        fontFamily: 'Inter_400Regular',
    },
    toggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 20,
    },
    toggleText: {
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
    saveButton: {
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 8,
    },
    saveButtonDisabled: {
        opacity: 0.55,
    },
    saveGradient: {
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    saveText: {
        color: theme.colors.white,
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
});
