import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from '../src/theme/appTheme';
import { profilesRepo } from '../src/lib/profilesRepo';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import '../src/styles/global.css';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootShell />
        </ThemeProvider>
    );
}

function RootShell() {
    const { setSession, setProfile } = useAuthStore();
    const { theme } = useAppTheme();
    const activeProfileRequestRef = useRef<Promise<void> | null>(null);
    const activeProfileUserIdRef = useRef<string | null>(null);

    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    useEffect(() => {
        const syncProfile = (session: Session | null) => {
            setSession(session);

            if (!session?.user) {
                activeProfileUserIdRef.current = null;
                activeProfileRequestRef.current = null;
                setProfile(null);
                return;
            }

            const user = session.user;
            if (activeProfileUserIdRef.current !== user.id) {
                setProfile(null);
            }

            if (activeProfileRequestRef.current && activeProfileUserIdRef.current === user.id) {
                return;
            }

            activeProfileUserIdRef.current = user.id;
            activeProfileRequestRef.current = profilesRepo.ensureExists({
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata as Record<string, any> | null,
            }).then((profile) => {
                if (activeProfileUserIdRef.current === user.id) {
                    setProfile(profile);
                }
            }).catch((error: any) => {
                console.warn('[Auth] Failed to ensure profile:', error?.message ?? error);
            }).finally(() => {
                if (activeProfileUserIdRef.current === user.id) {
                    activeProfileRequestRef.current = null;
                }
            });
        };

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            void event;
            syncProfile(session);
        });

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            syncProfile(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <StatusBar style={theme.isDark ? 'light' : 'dark'} />
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg.primary } }}>
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="circles" />
                        <Stack.Screen name="user/[id]" />
                        <Stack.Screen
                            name="game/[id]"
                            options={{
                                presentation: 'modal',
                                headerShown: false,
                            }}
                        />
                    </Stack>
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
