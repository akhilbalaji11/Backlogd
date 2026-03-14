import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemeBackdrop } from '../../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../../src/components/ui/ThemeModeToggle';
import { profilesRepo } from '../../../src/lib/profilesRepo';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useAppTheme } from '../../../src/theme/appTheme';

export default function PeopleScreen() {
    const { theme } = useAppTheme();
    const { user } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [listMode, setListMode] = useState<'discover' | 'following' | 'followers'>('discover');

    const { data: people = [] } = useQuery({
        queryKey: ['people-directory', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, bio, created_at')
                .neq('id', user.id)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            return data ?? [];
        },
        enabled: !!user,
        staleTime: 1000 * 30,
    });

    const { data: followingIds = new Set<string>() } = useQuery({
        queryKey: ['people-following-state', user?.id],
        queryFn: async () => {
            if (!user) return new Set<string>();
            const { data, error } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);
            if (error) throw error;
            return new Set((data ?? []).map((row: any) => row.following_id as string));
        },
        enabled: !!user,
        staleTime: 1000 * 15,
    });

    const { data: followingProfiles = [] } = useQuery({
        queryKey: ['people-following-profiles', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data: edges, error: edgesError } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.id);
            if (edgesError) throw edgesError;
            const ids = (edges ?? []).map((row: any) => row.following_id as string).filter(Boolean);
            if (ids.length === 0) return [];

            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, bio')
                .in('id', ids);
            if (profileError) throw profileError;
            return profiles ?? [];
        },
        enabled: !!user,
        staleTime: 1000 * 15,
    });

    const { data: followerProfiles = [] } = useQuery({
        queryKey: ['people-follower-profiles', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data: edges, error: edgesError } = await supabase
                .from('follows')
                .select('follower_id')
                .eq('following_id', user.id);
            if (edgesError) throw edgesError;
            const ids = (edges ?? []).map((row: any) => row.follower_id as string).filter(Boolean);
            if (ids.length === 0) return [];

            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, bio')
                .in('id', ids);
            if (profileError) throw profileError;
            return profiles ?? [];
        },
        enabled: !!user,
        staleTime: 1000 * 15,
    });

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const source = listMode === 'discover'
            ? people
            : listMode === 'following'
                ? followingProfiles
                : followerProfiles;
        if (!q) return source;
        return source.filter((person: any) => {
            const name = person.display_name?.toLowerCase() ?? '';
            const bio = person.bio?.toLowerCase() ?? '';
            return name.includes(q) || bio.includes(q);
        });
    }, [people, followingProfiles, followerProfiles, listMode, query]);

    const followMutation = useMutation({
        mutationFn: async (targetUserId: string) => {
            if (!user) return;
            const isFollowing = followingIds.has(targetUserId);
            if (isFollowing) {
                await profilesRepo.unfollow(user.id, targetUserId);
            } else {
                await profilesRepo.follow(user.id, targetUserId);
                await supabase.from('activity_events').insert({
                    actor_id: user.id,
                    type: 'follow',
                    entity_id: targetUserId,
                    metadata: { following_id: targetUserId },
                });
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['people-following-state'] });
            await queryClient.invalidateQueries({ queryKey: ['people-directory'] });
            await queryClient.invalidateQueries({ queryKey: ['people-following-profiles'] });
            await queryClient.invalidateQueries({ queryKey: ['people-follower-profiles'] });
            await queryClient.invalidateQueries({ queryKey: ['activity-feed-raw'] });
            await queryClient.invalidateQueries({ queryKey: ['activity-feed-ranked'] });
        },
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.topRow}>
                    <Text style={[styles.headline, { color: theme.colors.text.primary }]}>People</Text>
                    <ThemeModeToggle compact />
                </View>

                <View
                    style={[
                        styles.searchShell,
                        { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border },
                    ]}
                >
                    <Ionicons name="search" size={18} color={theme.colors.text.secondary} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Find players by name"
                        placeholderTextColor={theme.colors.text.muted}
                        style={[styles.searchInput, { color: theme.colors.text.primary }]}
                    />
                </View>

                <View style={styles.modeRow}>
                    <ModeChip
                        label="Discover"
                        active={listMode === 'discover'}
                        onPress={() => setListMode('discover')}
                    />
                    <ModeChip
                        label={`Following (${followingProfiles.length})`}
                        active={listMode === 'following'}
                        onPress={() => setListMode('following')}
                    />
                    <ModeChip
                        label={`Followers (${followerProfiles.length})`}
                        active={listMode === 'followers'}
                        onPress={() => setListMode('followers')}
                    />
                </View>

                <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
                    {filtered.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                            <Ionicons name="people-outline" size={28} color={theme.colors.text.muted} />
                            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>No players found</Text>
                            <Text style={[styles.emptyCopy, { color: theme.colors.text.secondary }]}>
                                {listMode === 'discover'
                                    ? 'Try a broader search or create another account to test social flows.'
                                    : listMode === 'following'
                                        ? 'You are not following anyone yet.'
                                        : 'No one is following you yet.'}
                            </Text>
                        </View>
                    ) : (
                        filtered.map((person: any) => {
                            const isFollowing = followingIds.has(person.id);
                            return (
                                <TouchableOpacity
                                    key={person.id}
                                    activeOpacity={0.9}
                                    onPress={() => router.push(`/user/${person.id}` as any)}
                                    style={[styles.personCard, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}
                                >
                                    <View style={styles.personMeta}>
                                    {person.avatar_url ? (
                                        <Image
                                            source={{ uri: person.avatar_url }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                            transition={120}
                                        />
                                    ) : (
                                        <View style={[styles.avatarDot, { backgroundColor: theme.colors.hero.secondary }]} />
                                    )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.personName, { color: theme.colors.text.primary }]}>
                                                {person.display_name || 'Player'}
                                            </Text>
                                            <Text style={[styles.personBio, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                                                {person.bio?.trim() || 'Backlogd player'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            onPress={() => followMutation.mutate(person.id)}
                                            disabled={followMutation.isPending}
                                            style={[
                                                styles.followButton,
                                                {
                                                    borderColor: theme.colors.border,
                                                    backgroundColor: isFollowing ? `${theme.colors.hero.secondary}20` : 'transparent',
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.followText, { color: isFollowing ? theme.colors.hero.secondary : theme.colors.text.primary }]}>
                                                {isFollowing ? 'Following' : 'Follow'}
                                            </Text>
                                        </TouchableOpacity>
                                        <Ionicons name="chevron-forward" size={18} color={theme.colors.text.muted} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );

    function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
        return (
            <TouchableOpacity
                onPress={onPress}
                style={[
                    styles.modeChip,
                    {
                        borderColor: theme.colors.border,
                        backgroundColor: active ? theme.colors.surface.glassStrong : 'transparent',
                    },
                ]}
            >
                <Text style={[styles.modeChipText, { color: active ? theme.colors.text.primary : theme.colors.text.secondary }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    }
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1, paddingHorizontal: 20, paddingBottom: 100 },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    headline: {
        fontSize: 34,
        lineHeight: 38,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.3,
    },
    searchShell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 14,
        minHeight: 52,
        marginBottom: 14,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
        paddingVertical: 12,
    },
    modeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    modeChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    modeChipText: {
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
    },
    stack: {
        gap: 10,
        paddingBottom: 28,
    },
    personCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    personMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    avatarDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    personName: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    personBio: {
        marginTop: 3,
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    followButton: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    followText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    emptyState: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    emptyCopy: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
    },
});
