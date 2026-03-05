import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { GameSearchResult } from '../../domain/types';
import { colors, radius, spacing, typography } from '../../styles/tokens';

interface GameCardProps {
    game: GameSearchResult;
    onPress?: () => void;
}

export function GameCard({ game, onPress }: GameCardProps) {
    const normalizedRating = game.rating ? (game.rating / 20).toFixed(1) : null; // IGDB 0-100 → 0-5

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            {/* Cover art */}
            <View style={styles.coverContainer}>
                {game.coverUrl ? (
                    <Image
                        source={{ uri: game.coverUrl }}
                        style={styles.cover}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={styles.coverPlaceholder}>
                        <Ionicons name="game-controller" size={24} color={colors.text.muted} />
                    </View>
                )}
            </View>

            {/* Info */}
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>{game.title}</Text>

                {game.releaseDate && (
                    <Text style={styles.year}>{new Date(game.releaseDate).getFullYear()}</Text>
                )}

                {/* Genre chips (max 2) */}
                {game.genres.length > 0 && (
                    <View style={styles.chips}>
                        {game.genres.slice(0, 2).map((g) => (
                            <View key={g} style={styles.chip}>
                                <Text style={styles.chipText}>{g}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Community rating */}
                {normalizedRating && (
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={colors.star} />
                        <Text style={styles.rating}>{normalizedRating}</Text>
                        <Text style={styles.ratingLabel}> IGDB</Text>
                    </View>
                )}
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
    },
    coverContainer: { width: 56, height: 76, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.bg.tertiary },
    cover: { width: '100%', height: '100%' },
    coverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1, gap: spacing.xs },
    title: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.text.primary, lineHeight: 20 },
    year: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
        paddingHorizontal: spacing.sm, paddingVertical: 2,
        backgroundColor: colors.bg.tertiary, borderRadius: radius.full,
    },
    chipText: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    rating: { fontSize: typography.size.xs, fontFamily: 'Inter_600SemiBold', color: colors.star },
    ratingLabel: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.muted },
});
