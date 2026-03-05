import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../src/styles/tokens';

export default function WelcomeScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a0533', '#0D1117', '#0D1117']}
                style={StyleSheet.absoluteFill}
            />
            {/* Decorative orbs */}
            <View style={styles.orb1} />
            <View style={styles.orb2} />

            <SafeAreaView style={styles.inner}>
                {/* Logo */}
                <View style={styles.logoSection}>
                    <View style={styles.logoIcon}>
                        <Ionicons name="game-controller" size={36} color={colors.purple[400]} />
                    </View>
                    <Text style={styles.logoText}>Backlogd</Text>
                    <Text style={styles.tagline}>Your games. Your story.</Text>
                </View>

                {/* Features preview */}
                <View style={styles.features}>
                    {[
                        { icon: 'star', text: 'Rate & review every game you play' },
                        { icon: 'people', text: 'Follow friends and share discoveries' },
                        { icon: 'bulb', text: 'Get smart recommendations' },
                    ].map((f) => (
                        <View key={f.icon} style={styles.featureRow}>
                            <View style={styles.featureIcon}>
                                <Ionicons name={f.icon as any} size={18} color={colors.purple[400]} />
                            </View>
                            <Text style={styles.featureText}>{f.text}</Text>
                        </View>
                    ))}
                </View>

                {/* CTAs */}
                <View style={styles.ctas}>
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => router.push('/(auth)/sign-up')}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={[colors.purple[500], colors.purple[700]]}
                            style={styles.primaryBtnGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.primaryBtnText}>Create Account</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => router.push('/(auth)/sign-in')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.secondaryBtnText}>Sign In</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    inner: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'space-between', paddingVertical: spacing.xl },
    orb1: {
        position: 'absolute', top: -80, right: -80,
        width: 280, height: 280, borderRadius: 140,
        backgroundColor: colors.purple[700], opacity: 0.25,
    },
    orb2: {
        position: 'absolute', bottom: 120, left: -60,
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: colors.rose[500], opacity: 0.1,
    },
    logoSection: { alignItems: 'center', marginTop: spacing['2xl'] },
    logoIcon: {
        width: 80, height: 80, borderRadius: radius.xl,
        backgroundColor: colors.bg.tertiary,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.purple[700],
        marginBottom: spacing.base,
        shadowColor: colors.purple[500],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 10,
    },
    logoText: {
        fontSize: typography.size['3xl'],
        color: colors.text.primary,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1,
    },
    tagline: {
        fontSize: typography.size.base,
        color: colors.text.secondary,
        fontFamily: 'Inter_400Regular',
        marginTop: spacing.xs,
    },
    features: { gap: spacing.base },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    featureIcon: {
        width: 40, height: 40, borderRadius: radius.md,
        backgroundColor: colors.bg.tertiary,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    featureText: {
        flex: 1,
        fontSize: typography.size.base,
        color: colors.text.secondary,
        fontFamily: 'Inter_400Regular',
    },
    ctas: { gap: spacing.md, paddingBottom: spacing.base },
    primaryBtn: { borderRadius: radius.lg, overflow: 'hidden' },
    primaryBtnGradient: { paddingVertical: spacing.base + 2, alignItems: 'center' },
    primaryBtnText: {
        fontSize: typography.size.md,
        color: colors.white,
        fontFamily: 'Inter_600SemiBold',
    },
    secondaryBtn: {
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingVertical: spacing.base + 2,
        alignItems: 'center',
    },
    secondaryBtnText: {
        fontSize: typography.size.md,
        color: colors.text.primary,
        fontFamily: 'Inter_600SemiBold',
    },
});
