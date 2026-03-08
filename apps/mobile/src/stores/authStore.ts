import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { Profile } from '../domain/types';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';

interface AuthState {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    pendingSignup: {
        email: string;
        password: string;
    } | null;
    isLoading: boolean;
    isInitialized: boolean;
    // Actions
    setSession: (session: Session | null) => void;
    setProfile: (profile: Profile | null) => void;
    setPendingSignup: (pendingSignup: { email: string; password: string } | null) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    pendingSignup: null,
    isLoading: false,
    isInitialized: false,

    setSession: (session) => {
        set((state) => ({
            session,
            user: session?.user ?? null,
            pendingSignup: session?.user ? null : state.pendingSignup,
            isInitialized: true,
        }));
    },

    setProfile: (profile) => {
        set({ profile });
    },

    setPendingSignup: (pendingSignup) => {
        set({ pendingSignup });
    },

    signOut: async () => {
        set({ isLoading: true });
        try {
            const { error } = await withTimeout(supabase.auth.signOut(), 8_000, 'Sign out');
            if (error) throw error;
        } catch {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        } finally {
            set({ session: null, user: null, profile: null, pendingSignup: null, isLoading: false });
        }
    },
}));
