import { supabase } from './supabase';

type DiscoveryFeedbackType = 'open' | 'skip' | 'save' | 'played';
type DiscoverySource = 'discover' | 'feed' | 'circle';

export async function trackDiscoveryFeedback(input: {
    userId: string;
    providerGameId: string;
    feedbackType: DiscoveryFeedbackType;
    source: DiscoverySource;
}): Promise<void> {
    try {
        await supabase.from('discovery_feedback').insert({
            user_id: input.userId,
            provider_game_id: input.providerGameId,
            feedback_type: input.feedbackType,
            source: input.source,
        });
    } catch {
        // Best-effort telemetry should not break UX.
    }
}

export async function trackDiscoveryImpression(input: {
    userId: string;
    providerGameId: string;
    surface: 'discover_personalized' | 'discover_contrarian' | 'feed_context';
    reason: Record<string, unknown>;
}): Promise<void> {
    try {
        await supabase.from('discovery_impressions').insert({
            user_id: input.userId,
            provider_game_id: input.providerGameId,
            surface: input.surface,
            reason: input.reason,
        });
    } catch {
        // Best-effort telemetry should not break UX.
    }
}
