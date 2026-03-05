import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { Profile } from '../domain/types';
import { supabase } from '../lib/supabase';

interface AuthState {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    isLoading: boolean;
    isInitialized: boolean;
    // Actions
    setSession: (session: Session | null) => void;
    setProfile: (profile: Profile | null) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    profile: null,
    isLoading: false,
    isInitialized: false,

    setSession: (session) => {
        set({ session, user: session?.user ?? null, isInitialized: true });
    },

    setProfile: (profile) => {
        set({ profile });
    },

    signOut: async () => {
        set({ isLoading: true });
        await supabase.auth.signOut();
        set({ session: null, user: null, profile: null, isLoading: false });
    },
}));
