import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.\n' +
        'Copy .env.example → .env and fill in your Supabase credentials.'
    );
}

// Supabase sessions can exceed SecureStore's 2048-byte limit.
// This adapter chunks large values across multiple keys.
const CHUNK_SIZE = 1900;

const ChunkedSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === 'web') return localStorage.getItem(key);
        const countStr = await SecureStore.getItemAsync(`${key}_count`);
        if (!countStr) {
            // Legacy single-value or not stored yet
            return SecureStore.getItemAsync(key);
        }
        const count = parseInt(countStr, 10);
        const chunks: string[] = [];
        for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
            if (chunk === null) return null;
            chunks.push(chunk);
        }
        return chunks.join('');
    },

    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
            return;
        }
        if (value.length <= CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
            await SecureStore.deleteItemAsync(`${key}_count`);
            return;
        }
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
            chunks.push(value.slice(i, i + CHUNK_SIZE));
        }
        await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
        for (let i = 0; i < chunks.length; i++) {
            await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
        }
    },

    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
            return;
        }
        const countStr = await SecureStore.getItemAsync(`${key}_count`);
        if (countStr) {
            const count = parseInt(countStr, 10);
            await SecureStore.deleteItemAsync(`${key}_count`);
            for (let i = 0; i < count; i++) {
                await SecureStore.deleteItemAsync(`${key}_${i}`);
            }
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    },
};

export const supabase = createClient(
    supabaseUrl ?? 'https://placeholder.supabase.co',
    supabaseAnonKey ?? 'placeholder',
    {
        auth: {
            storage: ChunkedSecureStoreAdapter as any,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
);
