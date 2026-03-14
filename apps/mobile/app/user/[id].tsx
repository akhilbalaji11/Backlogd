import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { GameCard } from '../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../src/components/ui/ThemeModeToggle';
import type { GameStatus } from '../../src/domain/types';
import { profilesRepo } from '../../src/lib/profilesRepo';
import { supabase } from '../../src/lib/supabase';
import { withTimeout } from '../../src/lib/withTimeout';
import { useAuthStore } from '../../src/stores/authStore';
import { useAppTheme } from '../../src/theme/appTheme';

type ProfileTabKey = 'played' | 'playing' | 'backlog' | 'wishlist' | 'reviews' | 'lists';

const TABS: Array<{ key: ProfileTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: 'played', label: 'Played', icon: 'checkmark-circle' },
    { key: 'playing', label: 'Playing', icon: 'game-controller' },
    { key: 'backlog', label: 'Backlog', icon: 'time' },
    { key: 'wishlist', label: 'Wishlist', icon: 'heart' },
    { key: 'reviews', label: 'Reviews', icon: 'star' },
    { key: 'lists', label: 'Lists', icon: 'list' },
];

export default function PublicProfileScreen() {
    const { theme } = useAppTheme();
    const { user } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ id: string }>();
    const profileId = params.id;
    const [activeTab, setActiveTab] = useState<ProfileTabKey>('played');

    const { data: profileData } = useQuery({
        queryKey: ['public-profile', profileId],
        queryFn: async () => {
            if (!profileId) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, bio, avatar_url')
                .eq('id', profileId)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!profileId,
    });

    const { data: statusRows = [] } = useQuery({
        queryKey: ['public-profile-statuses', profileId],
        queryFn: async () => {
            if (!profileId) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('user_game_status')
                    .select('status,last_updated,game:games(id,provider_game_id,title,cover_url,release_date,genres,platforms,rating)')
                    .eq('user_id', profileId)
                    .order('last_updated', { ascending: false }),
                8_000,
                'Load public statuses'
            );
            if (error) throw error;
            return (data ?? []).filter((row: any) => !!row.game).map((row: any) => ({
                status: row.status as GameStatus,
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
        enabled: !!profileId,
    });

    const { data: reviews = [] } = useQuery({
        queryKey: ['public-profile-reviews', profileId],
        queryFn: async () => {
            if (!profileId) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('reviews')
                    .select('id,rating,review_text,updated_at,game:games(id,provider_game_id,title,cover_url,release_date,genres,platforms,rating)')
                    .eq('user_id', profileId)
                    .order('updated_at', { ascending: false }),
                8_000,
                'Load public reviews'
            );
            if (error) throw error;
            return (data ?? []).filter((row: any) => !!row.game).map((row: any) => ({
                id: row.id,
                rating: Number(row.rating),
                reviewText: row.review_text ?? undefined,
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
        enabled: !!profileId,
    });

    const { data: lists = [] } = useQuery({
        queryKey: ['public-profile-lists', profileId],
        queryFn: async () => {
            if (!profileId) return [];
            const { data, error } = await withTimeout(
                supabase
                    .from('lists')
                    .select('id,title,description,is_public,updated_at,item_count:list_items(count)')
                    .eq('user_id', profileId)
                    .order('updated_at', { ascending: false }),
                8_000,
                'Load public lists'
            );
            if (error) throw error;
            return (data ?? []).filter((row: any) => row.is_public || profileId === user?.id).map((row: any) => ({
                id: row.id,
                title: row.title,
                description: row.description ?? undefined,
                itemCount: Array.isArray(row.item_count) ? row.item_count[0]?.count ?? 0 : 0,
            }));
        },
        enabled: !!profileId,
    });

    const { data: socialCounts = { followers: 0, following: 0 } } = useQuery({
        queryKey: ['public-profile-social-counts', profileId],
        queryFn: async () => {
            if (!profileId) return { followers: 0, following: 0 };
            const [followers, following] = await Promise.all([
                profilesRepo.getFollowerCount(profileId),
                profilesRepo.getFollowingCount(profileId),
            ]);
            return { followers, following };
        },
        enabled: !!profileId,
    });

    const { data: amFollowing = false } = useQuery({
        queryKey: ['public-profile-am-following', user?.id, profileId],
        queryFn: async () => {
            if (!user?.id || !profileId || user.id === profileId) return false;
            return profilesRepo.isFollowing(user.id, profileId);
        },
        enabled: !!user?.id && !!profileId,
    });

    const followMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id || !profileId || user.id === profileId) return;
            if (amFollowing) {
                await profilesRepo.unfollow(user.id, profileId);
            } else {
                await profilesRepo.follow(user.id, profileId);
                await supabase.from('activity_events').insert({
                    actor_id: user.id,
                    type: 'follow',
                    entity_id: profileId,
                    metadata: { following_id: profileId },
                });
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['public-profile-am-following'] });
            await queryClient.invalidateQueries({ queryKey: ['public-profile-social-counts'] });
            await queryClient.invalidateQueries({ queryKey: ['activity-feed-raw'] });
            await queryClient.invalidateQueries({ queryKey: ['activity-feed-ranked'] });
        },
    });

    const statusItems = useMemo(
        () => statusRows.filter((row: any) => row.status === activeTab),
        [activeTab, statusRows]
    );

    const displayName = profileData?.display_name || 'Player';
    const avatarUrl = profileData?.avatar_url?.trim() || undefined;

    if (user?.id && profileId && user.id === profileId) {
        return <Redirect href="/(tabs)/profile" />;
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: theme.colors.border }]}>
                            <Ionicons name="chevron-back" size={18} color={theme.colors.text.primary} />
                        </TouchableOpacity>
                        <ThemeModeToggle compact />
                    </View>

                    <LinearGradient
                        colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <View style={styles.heroHead}>
                            {avatarUrl ? (
                                <Image
                                    source={{ uri: avatarUrl }}
                                    style={styles.avatar}
                                    contentFit="cover"
                                    transition={140}
                                />
                            ) : (
                                <View style={styles.avatarFallback}>
                                    <Ionicons name="person" size={24} color="#fff" />
                                </View>
                            )}
                        </View>
                        <Text style={styles.displayName}>{displayName}</Text>
                        {!!profileData?.bio && <Text style={styles.bio}>{profileData.bio}</Text>}
                        <View style={styles.statRow}>
                            <StatPill label="Followers" value={socialCounts.followers} />
                            <StatPill label="Following" value={socialCounts.following} />
                            <StatPill label="Reviews" value={reviews.length} />
                        </View>
                        {user?.id && user.id !== profileId && (
                            <TouchableOpacity
                                onPress={() => followMutation.mutate()}
                                style={styles.followAction}
                                disabled={followMutation.isPending}
                            >
                                <Text style={styles.followActionText}>
                                    {amFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>
                        )}
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
                                    <Text style={[styles.tabText, { color: active ? theme.colors.text.primary : theme.colors.text.secondary }]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.contentStack}>
                        {activeTab === 'reviews' && (
                            reviews.length === 0 ? <EmptyCard title="No reviews yet" /> : reviews.map((review: any) => (
                                <TouchableOpacity
                                    key={review.id}
                                    activeOpacity={0.9}
                                    onPress={() => router.push(`/game/${review.game.providerId}`)}
                                    style={[styles.detailCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}
                                >
                                    <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>{review.game.title}</Text>
                                    <Text style={[styles.cardBody, { color: theme.colors.text.secondary }]}>
                                        {review.reviewText?.trim() || 'No written review'}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}

                        {activeTab === 'lists' && (
                            lists.length === 0 ? <EmptyCard title="No public lists yet" /> : lists.map((list: any) => (
                                <View key={list.id} style={[styles.detailCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>{list.title}</Text>
                                    {!!list.description && <Text style={[styles.cardBody, { color: theme.colors.text.secondary }]}>{list.description}</Text>}
                                    <Text style={[styles.cardMeta, { color: theme.colors.hero.secondary }]}>{list.itemCount} games</Text>
                                </View>
                            ))
                        )}

                        {activeTab !== 'reviews' && activeTab !== 'lists' && (
                            statusItems.length === 0 ? <EmptyCard title={`No ${activeTab} games`} /> : statusItems.map((item: any, idx: number) => (
                                <GameCard
                                    key={`${item.game.providerId}-${idx}`}
                                    game={item.game}
                                    status={item.status}
                                    showStatus={false}
                                    onPress={() => router.push(`/game/${item.game.providerId}`)}
                                />
                            ))
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );

    function EmptyCard({ title }: { title: string }) {
        return (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                <Ionicons name="cube-outline" size={24} color={theme.colors.text.muted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>{title}</Text>
            </View>
        );
    }

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
    scroll: { paddingHorizontal: 20, paddingBottom: 120 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hero: { borderRadius: 28, padding: 20, marginBottom: 14 },
    heroHead: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    avatarFallback: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    displayName: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold', lineHeight: 32 },
    bio: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
    statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statPill: { flex: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: 10, alignItems: 'center' },
    statValue: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18 },
    statLabel: { color: 'rgba(255,255,255,0.82)', fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 4 },
    followAction: {
        marginTop: 14,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        alignItems: 'center',
    },
    followActionText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
    tabRow: { gap: 10, paddingBottom: 12 },
    tabButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
    tabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    contentStack: { gap: 10 },
    detailCard: { borderWidth: 1, borderRadius: 20, padding: 14 },
    cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
    cardBody: { marginTop: 8, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
    cardMeta: { marginTop: 10, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
    emptyCard: { borderWidth: 1, borderRadius: 22, padding: 20, alignItems: 'center' },
    emptyTitle: { marginTop: 10, fontSize: 16, fontFamily: 'Inter_700Bold' },
});
