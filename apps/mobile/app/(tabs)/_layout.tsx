import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { useAuthStore } from '../../src/stores/authStore';
import { useAppTheme } from '../../src/theme/appTheme';

function TabIcon({
    name,
    color,
    focused,
    accent,
}: {
    name: string;
    color: string;
    focused: boolean;
    accent: string;
}) {
    return (
        <View style={[styles.iconContainer, focused && { backgroundColor: `${accent}18` }]}>
            <Ionicons name={name as any} size={22} color={color} />
            {focused && <View style={[styles.glowDot, { backgroundColor: accent }]} />}
        </View>
    );
}

export default function TabsLayout() {
    const { session, isInitialized } = useAuthStore();
    const { theme } = useAppTheme();

    if (!isInitialized) return null;

    if (!session) {
        return <Redirect href="/(auth)" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: theme.colors.bg.primary },
                tabBarStyle: {
                    backgroundColor: theme.colors.surface.glassStrong,
                    borderTopColor: 'transparent',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    height: Platform.OS === 'ios' ? 90 : 76,
                    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
                    paddingTop: 10,
                    elevation: 0,
                    position: 'absolute',
                    left: 14,
                    right: 14,
                    bottom: Platform.OS === 'ios' ? 14 : 12,
                    borderRadius: 28,
                    shadowColor: theme.colors.surface.cardShadow,
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: theme.isDark ? 0.28 : 0.08,
                    shadowRadius: 16,
                },
                tabBarActiveTintColor: theme.colors.hero.primary,
                tabBarInactiveTintColor: theme.colors.text.muted,
                tabBarLabelStyle: {
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 10,
                    marginTop: 8,
                    letterSpacing: 0.3,
                },
            }}
        >
            <Tabs.Screen
                name="discover/index"
                options={{
                    title: 'Discover',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name="compass" color={color} focused={focused} accent={theme.colors.hero.primary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="search/index"
                options={{
                    title: 'Search',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name="search" color={color} focused={focused} accent={theme.colors.hero.secondary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="diary/index"
                options={{
                    title: 'Diary',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name="calendar" color={color} focused={focused} accent={theme.colors.hero.tertiary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="lists/index"
                options={{
                    title: 'Lists',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name="list" color={color} focused={focused} accent={theme.colors.hero.quaternary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="people/index"
                options={{
                    title: 'People',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name="people" color={color} focused={focused} accent={theme.colors.hero.secondary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile/index"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon name="person" color={color} focused={focused} accent={theme.colors.neon.orange} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 46,
        height: 34,
        borderRadius: 16,
    },
    glowDot: {
        position: 'absolute',
        bottom: -2,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
