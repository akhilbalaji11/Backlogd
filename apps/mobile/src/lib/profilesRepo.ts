import { File as ExpoFile } from 'expo-file-system';
import type { Platform, Profile } from '../domain/types';
import { supabase } from '../lib/supabase';
import { withTimeout } from './withTimeout';

type EnsureProfileUser = {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any> | null;
};

type AvatarUploadOptions = {
    fileName?: string | null;
    mimeType?: string | null;
};

const ensureProfileRequests = new Map<string, Promise<Profile | null>>();

function normalizeAvatarUrl(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return trimmed;
}

function toAvatarExtension(fileName?: string | null, mimeType?: string | null, uri?: string): string {
    const fromFileName = fileName?.split('.').pop()?.toLowerCase();
    const fromUri = uri?.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase();
    const fromMimeType = mimeType?.split('/').pop()?.toLowerCase();
    const extension = fromFileName || fromUri || fromMimeType || 'jpg';

    if (extension === 'jpeg') return 'jpg';
    if (extension === 'heif') return 'heic';
    return extension;
}

function toProfile(row: Record<string, any>): Profile {
    return {
        id: row.id,
        displayName: row.display_name,
        bio: row.bio ?? undefined,
        avatarUrl: normalizeAvatarUrl(row.avatar_url),
        favoritePlatforms: (row.favorite_platforms ?? []) as Platform[],
        createdAt: row.created_at,
    };
}

export const profilesRepo = {
    async ensureExists(user: EnsureProfileUser): Promise<Profile | null> {
        const inFlight = ensureProfileRequests.get(user.id);
        if (inFlight) return inFlight;

        const request = (async () => {
            const existing = await profilesRepo.getById(user.id);
            if (existing) return existing;

            const displayName =
                user.user_metadata?.display_name?.toString().trim()
                || user.email?.split('@')[0]
                || 'Gamer';

            const { data, error } = await withTimeout(
                supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        display_name: displayName,
                        bio: null,
                        avatar_url: null,
                        favorite_platforms: [],
                    })
                    .select()
                    .single(),
                10_000,
                'Ensure profile'
            );

            if (error) {
                if (error.code === '23505') {
                    return profilesRepo.getById(user.id);
                }
                throw error;
            }

            return toProfile(data);
        })().finally(() => {
            ensureProfileRequests.delete(user.id);
        });

        ensureProfileRequests.set(user.id, request);
        return request;
    },

    async getById(id: string): Promise<Profile | null> {
        const { data, error } = await withTimeout(
            supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .maybeSingle(),
            10_000,
            'Load profile'
        );
        if (error) throw error;
        if (!data) return null;
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

    async uploadAvatar(userId: string, uri: string, options: AvatarUploadOptions = {}): Promise<string> {
        const ext = toAvatarExtension(options.fileName, options.mimeType, uri);
        const version = Date.now();
        const fileName = `${userId}/avatar-${version}.${ext}`;
        const contentType = options.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const file = new ExpoFile(uri);
        const bytes = await file.arrayBuffer();

        const { data: existingFiles } = await supabase.storage
            .from('avatars')
            .list(userId, { limit: 100 });
        const filesToDelete = (existingFiles ?? []).map((file) => `${userId}/${file.name}`);

        const { error } = await supabase.storage
            .from('avatars')
            .upload(fileName, bytes, { upsert: false, contentType });
        if (error) throw error;

        if (filesToDelete.length > 0) {
            await supabase.storage.from('avatars').remove(filesToDelete);
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        return data.publicUrl;
    },

    async removeAvatar(userId: string): Promise<void> {
        const { data: existingFiles } = await supabase.storage
            .from('avatars')
            .list(userId, { limit: 100 });
        const filesToDelete = (existingFiles ?? []).map((file) => `${userId}/${file.name}`);
        if (filesToDelete.length === 0) return;

        const { error } = await supabase.storage.from('avatars').remove(filesToDelete);
        if (error) throw error;
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
        const { data, error } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .maybeSingle();
        if (error) throw error;
        return !!data;
    },

    async follow(followerId: string, followingId: string): Promise<void> {
        const { error } = await supabase
            .from('follows')
            .insert({ follower_id: followerId, following_id: followingId });
        if (error) throw error;
    },

    async unfollow(followerId: string, followingId: string): Promise<void> {
        const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', followerId).eq('following_id', followingId);
        if (error) throw error;
    },
};
