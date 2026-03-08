import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeBackdrop } from '../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../src/components/ui/ThemeModeToggle';
import { useAppTheme } from '../../src/theme/appTheme';

function CTAButton({
    title,
    onPress,
    secondary = false,
}: {
    title: string;
    onPress: () => void;
    secondary?: boolean;
}) {
    const { theme } = useAppTheme();
    const scale = useRef(new Animated.Value(1)).current;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.92}
            onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, friction: 8 }).start()}
            onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start()}
        >
            <Animated.View style={{ transform: [{ scale }] }}>
                {secondary ? (
                    <View style={[styles.secondaryButton, { backgroundColor: theme.colors.surface.glassStrong, borderColor: theme.colors.border }]}>
                        <Text style={[styles.secondaryButtonText, { color: theme.colors.text.primary }]}>{title}</Text>
                    </View>
                ) : (
                    <LinearGradient
                        colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.primaryButton}
                    >
                        <Text style={styles.primaryButtonText}>{title}</Text>
                    </LinearGradient>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
}

function FeatureTile({ icon, title, blurb, accent }: { icon: keyof typeof Ionicons.glyphMap; title: string; blurb: string; accent: string }) {
    const { theme } = useAppTheme();

    return (
        <View style={[styles.featureTile, { backgroundColor: theme.colors.surface.glass, borderColor: theme.colors.border, shadowColor: theme.colors.surface.cardShadow }]}>
            <View style={[styles.featureIcon, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
                <Ionicons name={icon} size={18} color={accent} />
            </View>
            <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>{title}</Text>
            <Text style={[styles.featureBlurb, { color: theme.colors.text.secondary }]}>{blurb}</Text>
        </View>
    );
}

export default function WelcomeScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();
    const heroAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(heroAnim, {
            toValue: 1,
            friction: 6,
            tension: 48,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <View />
                        <ThemeModeToggle compact />
                    </View>

                    <Animated.View
                        style={[
                            styles.heroCard,
                            {
                                opacity: heroAnim,
                                transform: [
                                    { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                                    { scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
                                ],
                                backgroundColor: theme.colors.surface.glassStrong,
                                borderColor: theme.colors.border,
                                shadowColor: theme.colors.surface.cardShadow,
                            },
                        ]}
                    >
                        <LinearGradient
                            colors={[`${theme.colors.hero.primary}1A`, `${theme.colors.hero.secondary}11`, `${theme.colors.hero.tertiary}16`]}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.logoBadge}>
                            <LinearGradient
                                colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.logoBadgeGradient}
                            >
                                <Ionicons name="game-controller" size={34} color={theme.colors.white} />
                            </LinearGradient>
                        </View>
                        <Text style={[styles.kicker, { color: theme.colors.neon.orange }]}>Track. Review. Flex.</Text>
                        <Text style={[styles.title, { color: theme.colors.text.primary }]}>Backlogd</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                            A Letterboxd-style home for the games you finish, the ones you abandon, and the ones you swear you will get to next weekend.
                        </Text>

                        <View style={styles.featureGrid}>
                            <FeatureTile
                                icon="layers"
                                title="Colorful Lists"
                                blurb="Build shelves, challenge runs, and chaotic genre collections."
                                accent={theme.colors.hero.primary}
                            />
                            <FeatureTile
                                icon="sparkles"
                                title="Reactive Discovery"
                                blurb="Recommendations and search feel more like a game launcher than a form."
                                accent={theme.colors.hero.secondary}
                            />
                            <FeatureTile
                                icon="people"
                                title="Social Logging"
                                blurb="Follow friends and see what they are rating, dropping, and replaying."
                                accent={theme.colors.hero.tertiary}
                            />
                        </View>
                    </Animated.View>

                    <View style={styles.ctaStack}>
                        <CTAButton title="Create Account" onPress={() => router.push('/(auth)/sign-up')} />
                        <CTAButton title="Sign In" onPress={() => router.push('/(auth)/sign-in')} secondary />
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    scroll: {
        flexGrow: 1,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 6,
        marginBottom: 16,
    },
    heroCard: {
        borderRadius: 34,
        borderWidth: 1,
        paddingHorizontal: 24,
        paddingVertical: 28,
        overflow: 'hidden',
    },
    logoBadge: {
        width: 84,
        height: 84,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 18,
    },
    logoBadgeGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kicker: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    title: {
        fontSize: 40,
        lineHeight: 44,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.6,
    },
    subtitle: {
        marginTop: 12,
        fontSize: 15,
        lineHeight: 24,
        fontFamily: 'Inter_400Regular',
        maxWidth: 360,
    },
    featureGrid: {
        gap: 14,
        marginTop: 28,
    },
    featureTile: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 16,
    },
    featureIcon: {
        width: 38,
        height: 38,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    featureTitle: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        marginBottom: 4,
    },
    featureBlurb: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
    },
    ctaStack: {
        gap: 12,
        marginTop: 18,
    },
    primaryButton: {
        borderRadius: 22,
        paddingVertical: 18,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        color: '#ffffff',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        borderWidth: 1,
        borderRadius: 22,
        paddingVertical: 18,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
    },
});
