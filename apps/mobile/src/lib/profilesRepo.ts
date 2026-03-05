import type { Platform, Profile } from '../domain/types';
import { supabase } from '../lib/supabase';

function toProfile(row: Record<string, any>): Profile {
    return {
        id: row.id,
        displayName: row.display_name,
        bio: row.bio ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        favoritePlatforms: (row.favorite_platforms ?? []) as Platform[],
        createdAt: row.created_at,
    };
}

export const profilesRepo = {
    async getById(id: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) return null;
        return toProfile(data);
    },

    async upsert(profile: Partial<Profile> & { id: string }): Promise<Profile> {
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: profile.id,
                display_name: profile.displayName,
                bio: profile.bio ?? null,
                avatar_url: profile.avatarUrl ?? null,
                favorite_platforms: profile.favoritePlatforms ?? [],
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();
        if (error) throw error;
        return toProfile(data);
    },

    async uploadAvatar(userId: string, uri: string): Promise<string> {
        const ext = uri.split('.').pop() ?? 'jpg';
        const fileName = `${userId}/avatar.${ext}`;

        const response = await fetch(uri);
        const blob = await response.blob();

        const { error } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, { upsert: true, contentType: `image/${ext}` });
        if (error) throw error;

        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        return data.publicUrl;
    },

    async getFollowerCount(userId: string): Promise<number> {
        const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId);
        return count ?? 0;
    },

    async getFollowingCount(userId: string): Promise<number> {
        const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId);
        return count ?? 0;
    },

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        const { data } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .single();
        return !!data;
    },

    async follow(followerId: string, followingId: string): Promise<void> {
        await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
    },

    async unfollow(followerId: string, followingId: string): Promise<void> {
        await supabase.from('follows').delete()
            .eq('follower_id', followerId).eq('following_id', followingId);
    },
};
