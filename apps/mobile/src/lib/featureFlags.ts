import { supabase } from './supabase';

type FeatureFlagKey =
    | 'taste_graph'
    | 'discovery_personalized'
    | 'social_circles'
    | 'feed_ranker';

type FlagRow = {
    key: FeatureFlagKey;
    enabled: boolean;
    rollout_pct: number;
};

function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export async function isFeatureEnabled(
    key: FeatureFlagKey,
    userId?: string
): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('app_feature_flags')
            .select('key,enabled,rollout_pct')
            .eq('key', key)
            .maybeSingle<FlagRow>();
        if (error || !data || !data.enabled) return false;
        if (!userId) return data.rollout_pct > 0;
        const bucket = hashString(`${key}:${userId}`) % 100;
        return bucket < data.rollout_pct;
    } catch {
        return false;
    }
}
