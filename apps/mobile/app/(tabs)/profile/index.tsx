import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, radius, spacing, typography } from '../../../src/styles/tokens';

const TABS = ['Played', 'Playing', 'Backlog', 'Wishlist', 'Reviews', 'Lists'] as const;

export default function ProfileScreen() {
    const { profile, user, signOut } = useAuthStore();
    const router = useRouter();

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const displayName = profile?.displayName ?? user?.email?.split('@')[0] ?? 'You';

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        {profile?.avatarUrl ? (
                            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={28} color={colors.text.muted} />
                            </View>
                        )}
                        <View style={styles.headerInfo}>
                            <Text style={styles.displayName}>{displayName}</Text>
                            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                            {!profile && (
                                <TouchableOpacity onPress={() => router.push('/(auth)/profile-setup')}>
                                    <Text style={styles.completeProfile}>Complete your profile →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            style={styles.settingsBtn}
                            onPress={handleSignOut}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="log-out-outline" size={22} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Stats row */}
                    <View style={styles.stats}>
                        {[
                            { label: 'Played', value: '0' },
                            { label: 'Reviews', value: '0' },
                            { label: 'Lists', value: '0' },
                        ].map((s) => (
                            <View key={s.label} style={styles.statItem}>
                                <Text style={styles.statValue}>{s.value}</Text>
                                <Text style={styles.statLabel}>{s.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Platforms */}
                    {profile?.favoritePlatforms && profile.favoritePlatforms.length > 0 && (
                        <View style={styles.platforms}>
                            {profile.favoritePlatforms.map((p) => (
                                <View key={p} style={styles.platformChip}>
                                    <Text style={styles.platformText}>{p}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Collection tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                    {TABS.map((tab) => (
                        <TouchableOpacity key={tab} style={styles.tab}>
                            <Text style={styles.tabText}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Empty state */}
                <View style={styles.emptyState}>
                    <Ionicons name="game-controller-outline" size={48} color={colors.text.muted} />
                    <Text style={styles.emptyTitle}>No games logged yet</Text>
                    <Text style={styles.emptyMessage}>Search for a game and add it to your collection.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    scroll: { flexGrow: 1 },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.base },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginBottom: spacing.lg },
    avatar: { width: 72, height: 72, borderRadius: 36 },
    avatarPlaceholder: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: colors.bg.tertiary,
        borderWidth: 1.5, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: { flex: 1 },
    displayName: { fontSize: typography.size.lg, fontFamily: 'Inter_700Bold', color: colors.text.primary },
    bio: { fontSize: typography.size.sm, fontFamily: 'Inter_400Regular', color: colors.text.secondary, marginTop: 4 },
    completeProfile: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.purple[400], marginTop: 4 },
    settingsBtn: { padding: spacing.sm },
    stats: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.base },
    statItem: { alignItems: 'center', gap: 2 },
    statValue: { fontSize: typography.size.xl, fontFamily: 'Inter_700Bold', color: colors.text.primary },
    statLabel: { fontSize: typography.size.xs, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    platformChip: {
        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
        borderRadius: radius.full, backgroundColor: colors.bg.tertiary,
        borderWidth: 1, borderColor: colors.border,
    },
    platformText: { fontSize: typography.size.xs, fontFamily: 'Inter_500Medium', color: colors.text.secondary },
    tabRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
    tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.base },
    tabText: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.text.secondary },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing['2xl'], paddingHorizontal: spacing.lg },
    emptyTitle: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
    emptyMessage: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textAlign: 'center', maxWidth: 280 },
});
