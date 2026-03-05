import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AuthLayout() {
    const { session, isInitialized } = useAuthStore();

    // Wait for auth to initialize before redirecting
    if (!isInitialized) return null;

    // If already logged in, send to tabs
    if (session) {
        return <Redirect href="/(tabs)/discover" />;
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="profile-setup" />
        </Stack>
    );
}
