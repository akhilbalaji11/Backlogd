import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameSearchResult, GameStatus } from '../../domain/types';
import { useAppTheme } from '../../theme/appTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GameCardProps {
    game: GameSearchResult;
    onPress?: () => void;
    status?: GameStatus | null;
    userRating?: number;
    compact?: boolean;
    showStatus?: boolean;
}

const MATCH_META = {
    company: { icon: 'business-outline', label: 'Developer match' },
    character: { icon: 'person-outline', label: 'Character match' },
} as const;

export function GameCard({ game, onPress, status, userRating, compact = false, showStatus = true }: GameCardProps) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const normalizedRating = game.rating ? (game.rating / 20).toFixed(1) : null;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const matchMeta = game.matchType && game.matchType !== 'title' ? MATCH_META[game.matchType] : null;

    const pressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, friction: 8 }).start();
    };
    const pressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    };

    if (compact) {
        return (
            <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={styles.compactContainer}>
                <Animated.View style={[styles.compactCard, { transform: [{ scale: scaleAnim }] }]}>
                    <View style={styles.compactCoverShell}>
                        {game.coverUrl ? (
                            <Image source={{ uri: game.coverUrl }} style={styles.compactCover} contentFit="cover" transition={150} />
                        ) : (
                            <View style={styles.compactCoverPlaceholder}>
                                <Ionicons name="game-controller" size={16} color={theme.colors.text.muted} />
                            </View>
                        )}
                    </View>
                    <Text style={styles.compactTitle} numberOfLines={1}>{game.title}</Text>
                    {game.releaseDate && <Text style={styles.compactYear}>{new Date(game.releaseDate).getFullYear()}</Text>}
                </Animated.View>
            </Pressable>
        );
    }

    return (
        <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={styles.container}>
            <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient
                    colors={[`${theme.colors.hero.quaternary}18`, `${theme.colors.hero.primary}10`, 'transparent']}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.coverWrap}>
                    <View style={[styles.coverGlow, { backgroundColor: `${theme.colors.hero.secondary}22` }]} />
                    {game.coverUrl ? (
                        <Image source={{ uri: game.coverUrl }} style={styles.cover} contentFit="cover" transition={180} />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Ionicons name="game-controller-outline" size={28} color={theme.colors.text.muted} />
                        </View>
                    )}
                </View>

                <View style={styles.info}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={2}>{game.title}</Text>
                        {game.releaseDate && <Text style={styles.year}>{new Date(game.releaseDate).getFullYear()}</Text>}
                    </View>

                    {game.genres.length > 0 && (
                        <View style={styles.genreRow}>
                            {game.genres.slice(0, 2).map((genre) => {
                                const genreStyle = theme.genreColors[genre] || theme.genreColors.default;
                                return (
                                    <View key={genre} style={[styles.genreChip, { backgroundColor: genreStyle.bg, borderColor: `${genreStyle.text}35` }]}>
                                        <Text style={[styles.genreText, { color: genreStyle.text }]}>{genre}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.metaRow}>
                        {userRating !== undefined && userRating > 0 ? (
                            <View style={styles.ratingGroup}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Ionicons
                                        key={star}
                                        name={star <= userRating ? 'star' : 'star-outline'}
                                        size={12}
                                        color={star <= userRating ? theme.colors.star : theme.colors.starEmpty}
                                    />
                                ))}
                                <Text style={styles.metaLabel}>Your rating</Text>
                            </View>
                        ) : normalizedRating ? (
                            <View style={styles.ratingGroup}>
                                <Ionicons name="star" size={12} color={theme.colors.star} />
                                <Text style={styles.ratingValue}>{normalizedRating}</Text>
                                <Text style={styles.metaLabel}>IGDB</Text>
                            </View>
                        ) : null}
                    </View>

                    {matchMeta && (
                        <View style={[styles.matchBadge, { backgroundColor: `${theme.colors.hero.secondary}16`, borderColor: `${theme.colors.hero.secondary}30` }]}>
                            <Ionicons name={matchMeta.icon} size={11} color={theme.colors.hero.secondary} />
                            <Text style={[styles.matchText, { color: theme.colors.hero.secondary }]} numberOfLines={1}>
                                {game.matchLabel ?? matchMeta.label}
                            </Text>
                        </View>
                    )}

                    {game.platforms.length > 0 && (
                        <View style={styles.platformRow}>
                            {game.platforms.slice(0, 3).map((platform) => (
                                <View
                                    key={platform}
                                    style={[
                                        styles.platformDot,
                                        { backgroundColor: `${theme.platformColors[platform] || theme.colors.text.muted}33` },
                                    ]}
                                >
                                    <View style={[styles.platformDotInner, { backgroundColor: theme.platformColors[platform] || theme.colors.text.muted }]} />
                                </View>
                            ))}
                            {game.platforms.length > 3 && (
                                <Text style={styles.platformMore}>+{game.platforms.length - 3}</Text>
                            )}
                        </View>
                    )}
                </View>

                {showStatus && status && (
                    <View style={[styles.statusBadge, { backgroundColor: `${theme.colors.status[status]}18`, borderColor: `${theme.colors.status[status]}40` }]}>
                        <Text style={[styles.statusText, { color: theme.colors.status[status] }]}>{theme.statusLabels[status]}</Text>
                    </View>
                )}

                <Ionicons name="chevron-forward" size={18} color={theme.colors.text.muted} style={styles.chevron} />
            </Animated.View>
        </Pressable>
    );
}

export function GameHeroCard({ game, onPress }: { game: GameSearchResult; onPress?: () => void }) {
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const normalizedRating = game.rating ? (game.rating / 20).toFixed(1) : null;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.985, useNativeDriver: true, friction: 8 }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
            style={styles.heroContainer}
        >
            <Animated.View style={[styles.heroCard, { transform: [{ scale: scaleAnim }] }]}>
                {game.coverUrl ? (
                    <Image source={{ uri: game.coverUrl }} style={styles.heroCover} contentFit="cover" transition={180} />
                ) : (
                    <View style={styles.heroCoverPlaceholder}>
                        <Ionicons name="game-controller" size={36} color={theme.colors.text.muted} />
                    </View>
                )}
                <LinearGradient
                    colors={['transparent', theme.colors.surface.overlay]}
                    style={styles.heroGradient}
                />
                <View style={styles.heroInfo}>
                    <Text style={styles.heroTitle} numberOfLines={2}>{game.title}</Text>
                    <View style={styles.heroMeta}>
                        {game.releaseDate && <Text style={styles.heroYear}>{new Date(game.releaseDate).getFullYear()}</Text>}
                        {normalizedRating && (
                            <View style={styles.heroRating}>
                                <Ionicons name="star" size={13} color={theme.colors.star} />
                                <Text style={styles.heroRatingValue}>{normalizedRating}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme']) => StyleSheet.create({
    container: {
        marginBottom: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface.glassStrong,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        gap: 14,
        overflow: 'hidden',
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: theme.isDark ? 0.24 : 0.12,
        shadowRadius: 18,
        elevation: 4,
    },
    coverWrap: {
        width: 66,
        height: 90,
        borderRadius: 18,
        position: 'relative',
    },
    coverGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 22,
        transform: [{ scale: 1.08 }],
    },
    cover: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
        backgroundColor: theme.colors.bg.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
        gap: 8,
    },
    titleRow: {
        gap: 3,
    },
    title: {
        fontSize: 15,
        lineHeight: 20,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
    },
    year: {
        fontSize: 11,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    genreRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    genreChip: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    genreText: {
        fontSize: 9,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.55,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingValue: {
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.star,
    },
    metaLabel: {
        fontSize: 10,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.muted,
    },
    matchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    matchText: {
        maxWidth: 175,
        fontSize: 10,
        fontFamily: 'Inter_600SemiBold',
    },
    platformRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    platformDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        padding: 1,
    },
    platformDotInner: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    platformMore: {
        fontSize: 10,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.muted,
        marginLeft: 2,
    },
    statusBadge: {
        position: 'absolute',
        top: 10,
        right: 42,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    statusText: {
        fontSize: 9,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.45,
    },
    chevron: {
        marginLeft: 'auto',
    },
    compactContainer: {
        width: 102,
    },
    compactCard: {
        alignItems: 'center',
        gap: 6,
    },
    compactCoverShell: {
        width: 84,
        height: 116,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface.glassStrong,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    compactCover: {
        width: '100%',
        height: '100%',
    },
    compactCoverPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactTitle: {
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.primary,
        textAlign: 'center',
    },
    compactYear: {
        fontSize: 10,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    heroContainer: {
        width: SCREEN_WIDTH * 0.44,
    },
    heroCard: {
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface.glassStrong,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.surface.cardShadow,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: theme.isDark ? 0.24 : 0.12,
        shadowRadius: 18,
        elevation: 4,
    },
    heroCover: {
        width: '100%',
        height: 210,
    },
    heroCoverPlaceholder: {
        height: 210,
        backgroundColor: theme.colors.bg.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 88,
    },
    heroInfo: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 14,
        gap: 4,
    },
    heroTitle: {
        fontSize: 16,
        lineHeight: 20,
        fontFamily: 'Inter_700Bold',
        color: '#ffffff',
    },
    heroMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    heroYear: {
        fontSize: 11,
        fontFamily: 'Inter_500Medium',
        color: 'rgba(255,255,255,0.75)',
    },
    heroRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroRatingValue: {
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.star,
    },
});
