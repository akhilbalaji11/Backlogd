import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { GameCard } from '../../../src/components/game/GameCard';
import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import type { GameStatus } from '../../../src/domain/types';
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
    const { profile, user, signOut } = useAuthStore();
    const { theme } = useAppTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ProfileTabKey>('played');

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

    const displayName = profile?.displayName ?? user?.email?.split('@')[0] ?? 'Player';
    const statusItems = statuses.filter((status) => status.status === activeTab);
    const renderSurface = () => {
        if (activeTab === 'reviews') {
            return reviews.length === 0 ? (
                <EmptySurface title="No reviews yet" subtitle="Rate a game and your review shelf will appear here." />
            ) : (
                reviews.map((review: any) => (
                    <View key={review.id} style={[styles.reviewCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                        <Text style={[styles.reviewTitle, { color: theme.colors.text.primary }]}>{review.game.title}</Text>
                        <Text style={[styles.reviewMeta, { color: theme.colors.hero.secondary }]}>
                            {review.rating.toFixed(1)} stars
                        </Text>
                        <Text style={[styles.reviewBody, { color: theme.colors.text.secondary }]}>
                            {review.reviewText?.trim() || 'No written review yet.'}
                        </Text>
                    </View>
                ))
            );
        }

        if (activeTab === 'lists') {
            return lists.length === 0 ? (
                <EmptySurface title="No lists yet" subtitle="Curate shelves for your favorite genres, moods, or challenge runs." />
            ) : (
                lists.map((list: any) => (
                    <View key={list.id} style={[styles.listCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                        <Text style={[styles.listTitle, { color: theme.colors.text.primary }]}>{list.title}</Text>
                        {!!list.description && <Text style={[styles.listBody, { color: theme.colors.text.secondary }]}>{list.description}</Text>}
                        <Text style={[styles.listMeta, { color: theme.colors.neon.orange }]}>{list.itemCount} games</Text>
                    </View>
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

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <Text style={[styles.topLabel, { color: theme.colors.neon.orange }]}>Player Card</Text>
                        <ThemeModeToggle compact />
                    </View>

                    <LinearGradient
                        colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <View style={styles.heroHeader}>
                            <View style={styles.avatarRing}>
                                {profile?.avatarUrl ? (
                                    <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Ionicons name="person" size={26} color={theme.colors.white} />
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity style={styles.settingsButton} onPress={signOut}>
                                <Ionicons name="log-out-outline" size={18} color={theme.colors.white} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.displayName}>{displayName}</Text>
                        <Text style={styles.heroBio}>
                            {profile?.bio || 'Curating a living diary of favorite bosses, abandoned side quests, and instant classics.'}
                        </Text>

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
        marginBottom: 12,
    },
    topLabel: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
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
    heroBio: {
        marginTop: 8,
        color: 'rgba(255,255,255,0.82)',
        fontSize: 14,
        lineHeight: 21,
        fontFamily: 'Inter_400Regular',
        maxWidth: 310,
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
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    reviewBody: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 21,
        fontFamily: 'Inter_400Regular',
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
