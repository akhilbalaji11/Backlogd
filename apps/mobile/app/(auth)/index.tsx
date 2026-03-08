import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeBackdrop } from '../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../src/components/ui/ThemeModeToggle';
import { useAppTheme } from '../../src/theme/appTheme';

type AuthMode = 'sign-up' | 'sign-in';

const AUTH_MODES: Record<
    AuthMode,
    {
        label: string;
        eyebrow: string;
        title: string;
        body: string;
        action: string;
        icon: keyof typeof Ionicons.glyphMap;
        route: '/(auth)/sign-up' | '/(auth)/sign-in';
    }
> = {
    'sign-up': {
        label: 'Create Account',
        eyebrow: 'New profile',
        title: 'Build your player card',
        body: 'Start logging the games you love, the ones you shelved, and the next obsession waiting in your backlog.',
        action: 'Create Account',
        icon: 'sparkles',
        route: '/(auth)/sign-up',
    },
    'sign-in': {
        label: 'Sign In',
        eyebrow: 'Welcome back',
        title: 'Return to your library',
        body: 'Jump back into your diary, ratings, lists, and unfinished campaigns without losing the momentum.',
        action: 'Sign In',
        icon: 'log-in',
        route: '/(auth)/sign-in',
    },
};

function BacklogdLogo() {
    const { theme } = useAppTheme();
    const tilt = useRef(new Animated.Value(0)).current;
    const orbit = useRef(new Animated.Value(0)).current;
    const shimmer = useRef(new Animated.Value(0)).current;
    const glow = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const tiltLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(tilt, {
                    toValue: 1,
                    duration: 2400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(tilt, {
                    toValue: 0,
                    duration: 2400,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ]),
        );

        const orbitLoop = Animated.loop(
            Animated.timing(orbit, {
                toValue: 1,
                duration: 14000,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );

        const shimmerLoop = Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1,
                duration: 2600,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        );

        const glowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(glow, {
                    toValue: 1,
                    duration: 1800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(glow, {
                    toValue: 0,
                    duration: 1800,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        );

        tiltLoop.start();
        orbitLoop.start();
        shimmerLoop.start();
        glowLoop.start();

        return () => {
            tiltLoop.stop();
            orbitLoop.stop();
            shimmerLoop.stop();
            glowLoop.stop();
        };
    }, [glow, orbit, shimmer, tilt]);

    const plateStyle = {
        transform: [
            { perspective: 900 },
            { translateY: tilt.interpolate({ inputRange: [0, 1], outputRange: [6, -6] }) },
            { rotateX: tilt.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '-8deg'] }) },
            { rotateY: tilt.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) },
            { rotateZ: tilt.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
        ],
    } as const;

    const orbitPrimaryStyle = {
        transform: [
            {
                rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
            },
        ],
    } as const;

    const orbitSecondaryStyle = {
        transform: [
            {
                rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }),
            },
        ],
    } as const;

    const shimmerStyle = {
        opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.45, 0.1] }),
        transform: [
            { rotate: '-16deg' },
            { translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-170, 170] }) },
        ],
    } as const;

    const glowStyle = {
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.46] }),
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }],
    } as const;

    return (
        <View style={styles.logoSection}>
            <View style={styles.logoStage}>
                <Animated.View style={[styles.logoGlow, glowStyle]}>
                    <LinearGradient
                        colors={[
                            `${theme.colors.hero.secondary}00`,
                            `${theme.colors.hero.secondary}3A`,
                            `${theme.colors.hero.tertiary}00`,
                        ]}
                        start={{ x: 0.15, y: 0.15 }}
                        end={{ x: 0.85, y: 0.85 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                <Animated.View style={[styles.orbitRingLarge, orbitPrimaryStyle, { borderColor: `${theme.colors.hero.primary}32` }]}>
                    <View style={[styles.orbitSpark, styles.orbitSparkTop, { backgroundColor: theme.colors.hero.primary }]} />
                    <View style={[styles.orbitSpark, styles.orbitSparkBottom, { backgroundColor: theme.colors.hero.tertiary }]} />
                </Animated.View>

                <Animated.View style={[styles.orbitRingSmall, orbitSecondaryStyle, { borderColor: `${theme.colors.hero.quaternary}28` }]}>
                    <View style={[styles.orbitSpark, styles.orbitSparkLeft, { backgroundColor: theme.colors.hero.quaternary }]} />
                    <View style={[styles.orbitSpark, styles.orbitSparkRight, { backgroundColor: theme.colors.hero.secondary }]} />
                </Animated.View>

                <Animated.View style={[styles.logoPlateStack, plateStyle]}>
                    <View style={[styles.logoPlateShadow, { backgroundColor: `${theme.colors.black}38` }]} />
                    <LinearGradient
                        colors={[theme.colors.hero.tertiary, theme.colors.hero.secondary]}
                        start={{ x: 0.2, y: 0.1 }}
                        end={{ x: 0.9, y: 0.9 }}
                        style={styles.logoPlateRear}
                    />
                    <LinearGradient
                        colors={[theme.colors.hero.primary, theme.colors.hero.secondary]}
                        start={{ x: 0.1, y: 0.1 }}
                        end={{ x: 0.9, y: 0.9 }}
                        style={styles.logoPlateMid}
                    />
                    <LinearGradient
                        colors={[theme.colors.hero.quaternary, theme.colors.hero.primary, theme.colors.hero.secondary]}
                        start={{ x: 0, y: 0.2 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.logoPlateFront}
                    >
                        <View style={[styles.logoPlateInset, { borderColor: `${theme.colors.white}30` }]}>
                            <Animated.View style={[styles.logoShimmer, shimmerStyle]}>
                                <LinearGradient
                                    colors={['transparent', `${theme.colors.white}A8`, 'transparent']}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            </Animated.View>
                            <Text style={[styles.logoGlyphShadow, { color: `${theme.colors.black}35` }]}>B</Text>
                            <Text style={[styles.logoGlyph, { color: theme.colors.white }]}>B</Text>
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>

            <View style={styles.wordmarkWrap}>
                <Text style={[styles.wordmarkDepthFar, { color: `${theme.colors.hero.tertiary}C8` }]}>Backlogd</Text>
                <Text style={[styles.wordmarkDepthMid, { color: `${theme.colors.hero.secondary}D0` }]}>Backlogd</Text>
                <Text style={[styles.wordmarkDepthNear, { color: `${theme.colors.hero.primary}E0` }]}>Backlogd</Text>
                <Text style={[styles.wordmarkFront, { color: theme.colors.text.primary }]}>Backlogd</Text>
            </View>

            <Text style={[styles.subheading, { color: theme.colors.text.secondary }]}>
                Your cinematic game journal for every finish, replay, rage quit, and next-up obsession.
            </Text>
        </View>
    );
}

function AuthModePanel({
    mode,
    onModeChange,
}: {
    mode: AuthMode;
    onModeChange: (nextMode: AuthMode) => void;
}) {
    const router = useRouter();
    const { theme } = useAppTheme();
    const [railWidth, setRailWidth] = useState(0);
    const selectedTab = useRef(new Animated.Value(mode === 'sign-up' ? 0 : 1)).current;
    const sheen = useRef(new Animated.Value(0)).current;
    const contentAnim = useRef(new Animated.Value(0)).current;
    const current = AUTH_MODES[mode];
    const indicatorWidth = railWidth > 8 ? (railWidth - 8) / 2 : 0;

    useEffect(() => {
        Animated.timing(selectedTab, {
            toValue: mode === 'sign-up' ? 0 : 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [mode, selectedTab]);

    useEffect(() => {
        const sheenLoop = Animated.loop(
            Animated.timing(sheen, {
                toValue: 1,
                duration: 3200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            }),
        );

        sheenLoop.start();

        return () => {
            sheenLoop.stop();
        };
    }, [sheen]);

    useEffect(() => {
        contentAnim.setValue(0);
        Animated.timing(contentAnim, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [contentAnim, mode]);

    const indicatorStyle = {
        width: indicatorWidth,
        transform: [
            {
                translateX: selectedTab.interpolate({ inputRange: [0, 1], outputRange: [0, indicatorWidth] }),
            },
        ],
    } as const;

    const sheenStyle = {
        opacity: sheen.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.24, 0] }),
        transform: [
            {
                translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-240, 240] }),
            },
            { rotate: '-18deg' },
        ],
    } as const;

    const contentStyle = {
        opacity: contentAnim,
        transform: [
            {
                translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
            },
        ],
    } as const;

    const handleRoute = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(current.route);
    };

    const handleSwap = () => {
        const nextMode: AuthMode = mode === 'sign-up' ? 'sign-in' : 'sign-up';
        void Haptics.selectionAsync();
        onModeChange(nextMode);
    };

    return (
        <View style={styles.authCardFrame}>
            <BlurView
                intensity={theme.isDark ? 45 : 65}
                tint={theme.isDark ? 'dark' : 'light'}
                style={[
                    styles.authCard,
                    {
                        borderColor: theme.colors.border,
                        shadowColor: theme.colors.surface.cardShadow,
                        backgroundColor: theme.colors.surface.glassStrong,
                    },
                ]}
            >
                <Animated.View style={[styles.authCardSheen, sheenStyle]}>
                    <LinearGradient
                        colors={['transparent', `${theme.colors.white}40`, 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                <View
                    onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
                    style={[styles.tabRail, { backgroundColor: theme.colors.surface.glass, borderColor: theme.colors.border }]}
                >
                    <Animated.View
                        style={[
                            styles.tabIndicator,
                            indicatorStyle,
                            {
                                backgroundColor: theme.isDark ? `${theme.colors.white}12` : `${theme.colors.hero.primary}14`,
                                borderColor: theme.colors.border,
                            },
                        ]}
                    />
                    {(['sign-up', 'sign-in'] as const).map((item) => {
                        const isActive = item === mode;
                        return (
                            <Pressable
                                key={item}
                                onPress={() => {
                                    if (isActive) return;
                                    void Haptics.selectionAsync();
                                    onModeChange(item);
                                }}
                                style={styles.tabButton}
                            >
                                <Text style={[styles.tabLabel, { color: isActive ? theme.colors.text.primary : theme.colors.text.secondary }]}>
                                    {AUTH_MODES[item].label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Animated.View style={[styles.authBody, contentStyle]}>
                    <View style={styles.authHeaderRow}>
                        <View style={[styles.authBadge, { backgroundColor: `${theme.colors.hero.secondary}1A`, borderColor: `${theme.colors.hero.secondary}3A` }]}>
                            <Ionicons name={current.icon} size={18} color={theme.colors.hero.secondary} />
                        </View>
                        <Text style={[styles.authEyebrow, { color: theme.colors.text.secondary }]}>{current.eyebrow}</Text>
                    </View>

                    <Text style={[styles.authTitle, { color: theme.colors.text.primary }]}>{current.title}</Text>
                    <Text style={[styles.authCopy, { color: theme.colors.text.secondary }]}>{current.body}</Text>

                    <Pressable onPress={handleRoute} style={({ pressed }) => [styles.primaryActionWrap, pressed && styles.actionPressed]}>
                        <LinearGradient
                            colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.primaryAction}
                        >
                            <Text style={styles.primaryActionText}>{current.action}</Text>
                            <View style={[styles.primaryActionIcon, { backgroundColor: `${theme.colors.white}22` }]}>
                                <Ionicons name="arrow-forward" size={16} color={theme.colors.white} />
                            </View>
                        </LinearGradient>
                    </Pressable>

                    <Pressable onPress={handleSwap} style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}>
                        <Text style={[styles.secondaryActionText, { color: theme.colors.text.secondary }]}>
                            {mode === 'sign-up' ? 'Already have an account? Switch to Sign In' : 'New here? Switch to Create Account'}
                        </Text>
                    </Pressable>
                </Animated.View>
            </BlurView>
        </View>
    );
}

export default function WelcomeScreen() {
    const { theme } = useAppTheme();
    const [mode, setMode] = useState<AuthMode>('sign-up');
    const heroEntrance = useRef(new Animated.Value(0)).current;
    const panelEntrance = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(80, [
            Animated.timing(heroEntrance, {
                toValue: 1,
                duration: 520,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(panelEntrance, {
                toValue: 1,
                duration: 520,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [heroEntrance, panelEntrance]);

    const heroStyle = {
        opacity: heroEntrance,
        transform: [
            {
                translateY: heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            },
        ],
    } as const;

    const panelStyle = {
        opacity: panelEntrance,
        transform: [
            {
                translateY: panelEntrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
            },
        ],
    } as const;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <View />
                        <ThemeModeToggle compact />
                    </View>

                    <Animated.View style={[styles.heroWrap, heroStyle]}>
                        <BacklogdLogo />
                    </Animated.View>

                    <Animated.View style={[styles.panelWrap, panelStyle]}>
                        <AuthModePanel mode={mode} onModeChange={setMode} />
                    </Animated.View>
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
        paddingBottom: 24,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 6,
    },
    heroWrap: {
        marginTop: 8,
    },
    panelWrap: {
        marginTop: 18,
    },
    logoSection: {
        alignItems: 'center',
        paddingTop: 12,
    },
    logoStage: {
        width: 300,
        height: 250,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoGlow: {
        position: 'absolute',
        width: 270,
        height: 270,
        borderRadius: 999,
    },
    orbitRingLarge: {
        position: 'absolute',
        width: 244,
        height: 244,
        borderRadius: 999,
        borderWidth: 1,
    },
    orbitRingSmall: {
        position: 'absolute',
        width: 184,
        height: 184,
        borderRadius: 999,
        borderWidth: 1,
    },
    orbitSpark: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 999,
        shadowOpacity: 0.28,
        shadowRadius: 12,
    },
    orbitSparkTop: {
        top: -6,
        left: '50%',
        marginLeft: -6,
    },
    orbitSparkBottom: {
        bottom: -6,
        left: '50%',
        marginLeft: -6,
    },
    orbitSparkLeft: {
        top: '50%',
        left: -6,
        marginTop: -6,
    },
    orbitSparkRight: {
        top: '50%',
        right: -6,
        marginTop: -6,
    },
    logoPlateStack: {
        width: 154,
        height: 154,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoPlateShadow: {
        position: 'absolute',
        width: 132,
        height: 132,
        borderRadius: 36,
        bottom: 4,
        transform: [{ translateY: 20 }, { scaleX: 1.05 }],
    },
    logoPlateRear: {
        position: 'absolute',
        width: 136,
        height: 136,
        borderRadius: 34,
        transform: [{ translateX: 12 }, { translateY: 16 }, { rotate: '-12deg' }],
    },
    logoPlateMid: {
        position: 'absolute',
        width: 136,
        height: 136,
        borderRadius: 34,
        transform: [{ translateX: -10 }, { translateY: 10 }, { rotate: '12deg' }],
    },
    logoPlateFront: {
        width: 132,
        height: 132,
        borderRadius: 34,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoPlateInset: {
        width: 112,
        height: 112,
        borderRadius: 28,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logoShimmer: {
        position: 'absolute',
        width: 90,
        height: 180,
    },
    logoGlyphShadow: {
        position: 'absolute',
        fontSize: 64,
        lineHeight: 72,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -3,
        transform: [{ translateX: 5 }, { translateY: 6 }],
    },
    logoGlyph: {
        fontSize: 64,
        lineHeight: 72,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -3,
    },
    wordmarkWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 86,
        marginTop: -6,
    },
    wordmarkDepthFar: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 18,
        fontSize: 42,
        lineHeight: 46,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -2,
        textAlign: 'center',
    },
    wordmarkDepthMid: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 12,
        fontSize: 42,
        lineHeight: 46,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -2,
        textAlign: 'center',
    },
    wordmarkDepthNear: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 6,
        fontSize: 42,
        lineHeight: 46,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -2,
        textAlign: 'center',
    },
    wordmarkFront: {
        fontSize: 42,
        lineHeight: 46,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -2,
    },
    subheading: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 24,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
        maxWidth: 320,
    },
    authCardFrame: {
        borderRadius: 34,
        overflow: 'hidden',
    },
    authCard: {
        borderRadius: 34,
        borderWidth: 1,
        padding: 18,
        overflow: 'hidden',
    },
    authCardSheen: {
        position: 'absolute',
        width: 120,
        height: 340,
        top: -30,
    },
    tabRail: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 20,
        padding: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    tabIndicator: {
        position: 'absolute',
        top: 4,
        left: 4,
        width: 144,
        bottom: 4,
        borderRadius: 16,
        borderWidth: 1,
    },
    tabButton: {
        flex: 1,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    tabLabel: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 0.2,
    },
    authBody: {
        marginTop: 18,
        paddingHorizontal: 4,
        paddingBottom: 4,
    },
    authHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    authBadge: {
        width: 38,
        height: 38,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    authEyebrow: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    authTitle: {
        fontSize: 29,
        lineHeight: 33,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.2,
    },
    authCopy: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 23,
        fontFamily: 'Inter_400Regular',
    },
    primaryActionWrap: {
        marginTop: 24,
    },
    primaryAction: {
        minHeight: 64,
        borderRadius: 24,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    primaryActionText: {
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 0.3,
    },
    primaryActionIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryAction: {
        marginTop: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    secondaryActionText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_600SemiBold',
        textAlign: 'center',
    },
    actionPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.985 }],
    },
});
