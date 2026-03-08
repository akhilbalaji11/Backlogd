import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../../theme/appTheme';

export function AuthBrand({ subtitle }: { subtitle: string }) {
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
        transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
    } as const;

    const orbitSecondaryStyle = {
        transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }],
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

            <Text style={[styles.subheading, { color: theme.colors.text.secondary }]}>{subtitle}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
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
});
