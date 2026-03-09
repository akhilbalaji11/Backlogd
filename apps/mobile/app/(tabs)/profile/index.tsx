import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { GameCard } from '../../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { GameStatus } from '../../../src/domain/types';
import { profilesRepo } from '../../../src/lib/profilesRepo';
import { supabase } from '../../../src/lib/supabase';
import { withTimeout } from '../../../src/lib/withTimeout';
import { useAuthStore } from '../../../src/stores/authStore';
import { useAppTheme } from '../../../src/theme/appTheme';

type ProfileTabKey = 'played' | 'playing' | 'backlog' | 'wishlist' | 'reviews' | 'lists';

const TABS: Array<{ key: ProfileTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: 'played', label: 'Played', icon: 'checkmark-circle' },
    { key: 'playing', label: 'Playing', icon: 'game-controller' },
    { key: 'backlog', label: 'Backlog', icon: 'time' },
    { key: 'wishlist', label: 'Wishlist', icon: 'heart' },
    { key: 'reviews', label: 'Reviews', icon: 'star' },
    { key: 'lists', label: 'Lists', icon: 'list' },
];

export default function ProfileScreen() {
    const { profile, user, setProfile, signOut } = useAuthStore();
    const { theme } = useAppTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ProfileTabKey>('played');
    const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

    const { data: statuses = [] } = useQuery({
        queryKey: ['profile-statuses', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('user_game_status')
                    .select('status,last_updated,game:games(id,provider_game_id,title,cover_url,release_date,genres,platforms,rating)')
                    .eq('user_id', user.id)
                    .order('last_updated', { ascending: false }),
                8_000,
                'Load statuses'
            );
            if (error) throw error;
            return (data ?? []).filter((row: any) => !!row.game).map((row: any) => ({
                status: row.status as GameStatus,
                lastUpdated: row.last_updated,
                game: {
                    id: row.game.id,
                    providerId: row.game.provider_game_id ?? row.id,
                    provider: 'igdb' as const,
                    title: row.game.title,
                    coverUrl: row.game.cover_url ?? undefined,
                    releaseDate: row.game.release_date ?? undefined,
                    genres: row.game.genres ?? [],
                    platforms: row.game.platforms ?? [],
                    rating: row.game.rating ?? undefined,
                },
            }));
        },
        enabled: !!user,
    });

    const { data: reviews = [] } = useQuery({
        queryKey: ['profile-reviews', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('reviews')
                    .select('id,rating,review_text,spoiler,updated_at,game:games(id,provider_game_id,title,cover_url,release_date,genres,platforms,rating)')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false }),
                8_000,
                'Load reviews'
            );
            if (error) throw error;
            return (data ?? []).filter((row: any) => !!row.game).map((row: any) => ({
                id: row.id,
                rating: Number(row.rating),
                reviewText: row.review_text ?? undefined,
                spoiler: row.spoiler ?? false,
                updatedAt: row.updated_at,
                game: {
                    id: row.game.id,
                    providerId: row.game.provider_game_id ?? row.id,
                    provider: 'igdb' as const,
                    title: row.game.title,
                    coverUrl: row.game.cover_url ?? undefined,
                    releaseDate: row.game.release_date ?? undefined,
                    genres: row.game.genres ?? [],
                    platforms: row.game.platforms ?? [],
                    rating: row.game.rating ?? undefined,
                },
            }));
        },
        enabled: !!user,
    });

    const { data: lists = [] } = useQuery({
        queryKey: ['profile-lists', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('lists')
                    .select('id,title,description,is_public,updated_at,item_count:list_items(count)')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false }),
                8_000,
                'Load lists'
            );
            if (error) throw error;
            return (data ?? []).map((row: any) => ({
                id: row.id,
                title: row.title,
                description: row.description ?? undefined,
                isPublic: row.is_public,
                updatedAt: row.updated_at,
                itemCount: Array.isArray(row.item_count) ? row.item_count[0]?.count ?? 0 : 0,
            }));
        },
        enabled: !!user,
    });

    const displayName =
        profile?.displayName
        ?? user?.user_metadata?.display_name?.toString().trim()
        ?? user?.email?.split('@')[0]
        ?? 'Player';
    const avatarUrl =
        profile?.avatarUrl
        ?? user?.user_metadata?.avatar_url?.toString().trim()
        ?? undefined;
    const statusItems = statuses.filter((status) => status.status === activeTab);

    const handleChangePhoto = async () => {
        if (!user || isUpdatingPhoto) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images' as const,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled) return;

        const asset = result.assets[0];
        setIsUpdatingPhoto(true);

        try {
            const baseProfile = profile ?? await profilesRepo.ensureExists({
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata as Record<string, any> | null,
            });
            const nextAvatarUrl = await profilesRepo.uploadAvatar(user.id, asset.uri, {
                fileName: asset.fileName,
                mimeType: asset.mimeType,
            });
            const nextProfile = await profilesRepo.upsert({
                id: user.id,
                displayName: baseProfile?.displayName ?? displayName,
                bio: baseProfile?.bio,
                avatarUrl: nextAvatarUrl,
                favoritePlatforms: baseProfile?.favoritePlatforms ?? [],
            });
            setProfile(nextProfile);
        } catch (error: any) {
            Alert.alert('Photo update failed', error?.message ?? 'Could not update your profile photo.');
        } finally {
            setIsUpdatingPhoto(false);
        }
    };

    const handleRemovePhoto = async () => {
        if (!user || !avatarUrl || isUpdatingPhoto) return;

        setIsUpdatingPhoto(true);
        try {
            const baseProfile = profile ?? await profilesRepo.ensureExists({
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata as Record<string, any> | null,
            });
            await profilesRepo.removeAvatar(user.id);
            const nextProfile = await profilesRepo.upsert({
                id: user.id,
                displayName: baseProfile?.displayName ?? displayName,
                bio: baseProfile?.bio,
                avatarUrl: undefined,
                favoritePlatforms: baseProfile?.favoritePlatforms ?? [],
            });
            setProfile(nextProfile);
        } catch (error: any) {
            Alert.alert('Photo removal failed', error?.message ?? 'Could not remove your profile photo.');
        } finally {
            setIsUpdatingPhoto(false);
        }
    };
    const renderSurface = () => {
        if (activeTab === 'reviews') {
            return reviews.length === 0 ? (
                <EmptySurface title="No reviews yet" subtitle="Rate a game and your review shelf will appear here." />
            ) : (
                reviews.map((review: any) => (
                    <TouchableOpacity
                        key={review.id}
                        activeOpacity={0.9}
                        onPress={() => router.push({ pathname: '/review-editor', params: { gameId: review.game.id, gameTitle: review.game.title } })}
                        style={[styles.reviewCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}
                    >
                        <Text style={[styles.reviewTitle, { color: theme.colors.text.primary }]}>{review.game.title}</Text>
                        <View style={styles.reviewMeta}>
                            {renderRatingStars(review.rating)}
                        </View>
                        <Text style={[styles.reviewBody, { color: theme.colors.text.secondary }]}>
                            {review.reviewText?.trim() || 'No written review yet.'}
                        </Text>
                        <Text style={[styles.reviewHint, { color: theme.colors.hero.secondary }]}>Tap to edit review</Text>
                    </TouchableOpacity>
                ))
            );
        }

        if (activeTab === 'lists') {
            return lists.length === 0 ? (
                <EmptySurface title="No lists yet" subtitle="Curate shelves for your favorite genres, moods, or challenge runs." />
            ) : (
                lists.map((list: any) => (
                    <TouchableOpacity
                        key={list.id}
                        activeOpacity={0.9}
                        onPress={() => router.push({ pathname: '/(tabs)/lists', params: { editListId: list.id } })}
                        style={[styles.listCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}
                    >
                        <Text style={[styles.listTitle, { color: theme.colors.text.primary }]}>{list.title}</Text>
                        {!!list.description && <Text style={[styles.listBody, { color: theme.colors.text.secondary }]}>{list.description}</Text>}
                        <Text style={[styles.listMeta, { color: theme.colors.neon.orange }]}>{list.itemCount} games</Text>
                        <Text style={[styles.listHint, { color: theme.colors.hero.secondary }]}>Tap to edit list</Text>
                    </TouchableOpacity>
                ))
            );
        }

        return statusItems.length === 0 ? (
            <EmptySurface title={`No ${activeTab} games`} subtitle="Search for something new and add it to this shelf." />
        ) : (
            statusItems.map((item: any, index: number) => (
                <GameCard
                    key={`${item.game.providerId}-${index}`}
                    game={item.game}
                    status={item.status}
                    showStatus={false}
                    onPress={() => router.push(`/game/${item.game.providerId}`)}
                />
            ))
        );
    };

    function EmptySurface({ title, subtitle }: { title: string; subtitle: string }) {
        return (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                <Ionicons name="cube-outline" size={28} color={theme.colors.text.muted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>{title}</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>{subtitle}</Text>
            </View>
        );
    }

    function renderRatingStars(rating: number) {
        return Array.from({ length: 5 }, (_, index) => {
            const starNumber = index + 1;
            let iconName: keyof typeof Ionicons.glyphMap = 'star-outline';

            if (rating >= starNumber) {
                iconName = 'star';
            } else if (rating >= starNumber - 0.5) {
                iconName = 'star-half';
            }

            return (
                <Ionicons
                    key={`${rating}-${starNumber}`}
                    name={iconName}
                    size={14}
                    color={theme.colors.hero.secondary}
                />
            );
        });
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <Text style={[styles.topTitle, { color: theme.colors.text.primary }]}>Profile</Text>
                        <ThemeModeToggle compact />
                    </View>

                    <LinearGradient
                        colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <View style={styles.heroHeader}>
                            <TouchableOpacity style={styles.avatarRing} onPress={handleChangePhoto} activeOpacity={0.9}>
                                {avatarUrl ? (
                                    <Image
                                        source={{ uri: avatarUrl }}
                                        style={styles.avatar}
                                        contentFit="cover"
                                        transition={150}
                                        cachePolicy="memory-disk"
                                    />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Ionicons name="person" size={26} color={theme.colors.white} />
                                    </View>
                                )}
                                <View style={styles.avatarActionBadge}>
                                    <Ionicons
                                        name={isUpdatingPhoto ? 'sync' : 'camera'}
                                        size={14}
                                        color={theme.colors.white}
                                    />
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsButton} onPress={signOut}>
                                <Ionicons name="log-out-outline" size={18} color={theme.colors.white} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.displayName}>{displayName}</Text>

                        {avatarUrl ? (
                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.photoSecondaryButton} onPress={handleRemovePhoto} disabled={isUpdatingPhoto}>
                                    <Ionicons name="trash-outline" size={16} color={theme.colors.white} />
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        <View style={styles.statRow}>
                            <StatPill label="Played" value={statuses.filter((item: any) => item.status === 'played').length} />
                            <StatPill label="Reviews" value={reviews.length} />
                            <StatPill label="Lists" value={lists.length} />
                        </View>
                    </LinearGradient>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
                        {TABS.map((tab) => {
                            const active = activeTab === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    onPress={() => setActiveTab(tab.key)}
                                    style={[
                                        styles.tabButton,
                                        {
                                            backgroundColor: active ? theme.colors.surface.glassStrong : 'transparent',
                                            borderColor: active ? theme.colors.border : 'transparent',
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={tab.icon}
                                        size={16}
                                        color={active ? theme.colors.text.primary : theme.colors.text.secondary}
                                    />
                                    <Text style={[styles.tabText, { color: active ? theme.colors.text.primary : theme.colors.text.secondary }]}>{tab.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.contentStack}>
                        {renderSurface()}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );

    function StatPill({ label, value }: { label: string; value: number }) {
        return (
            <View style={styles.statPill}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
            </View>
        );
    }
}
const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    topTitle: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.3,
    },
    hero: {
        borderRadius: 30,
        padding: 24,
        marginBottom: 18,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarRing: {
        width: 82,
        height: 82,
        borderRadius: 41,
        backgroundColor: 'rgba(255,255,255,0.22)',
        padding: 4,
        position: 'relative',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 37,
    },
    avatarPlaceholder: {
        flex: 1,
        borderRadius: 37,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    avatarActionBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(17,24,39,0.78)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    settingsButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    displayName: {
        color: '#ffffff',
        fontSize: 30,
        lineHeight: 34,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
    },
    photoSecondaryButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    statRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    statPill: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
    },
    statValue: {
        color: '#ffffff',
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
    },
    statLabel: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.78)',
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    tabRow: {
        gap: 10,
        paddingBottom: 12,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    tabText: {
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
    },
    contentStack: {
        gap: 12,
    },
    reviewCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 18,
    },
    reviewTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
    reviewMeta: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    reviewBody: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 21,
        fontFamily: 'Inter_400Regular',
    },
    reviewHint: {
        marginTop: 12,
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    listCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 18,
    },
    listTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
    listBody: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 21,
        fontFamily: 'Inter_400Regular',
    },
    listMeta: {
        marginTop: 10,
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    listHint: {
        marginTop: 12,
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    emptyCard: {
        borderRadius: 26,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    emptySubtitle: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        fontFamily: 'Inter_400Regular',
    },
});
