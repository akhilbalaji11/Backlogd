import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Alert,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AuthBrand } from '../../src/components/ui/AuthBrand';
import { FormField } from '../../src/components/ui/FormField';
import { ThemeBackdrop } from '../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../src/components/ui/ThemeModeToggle';
import { supabase } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/appTheme';

const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

function SignalPill({ icon, label, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint: string }) {
    const { theme } = useAppTheme();

    return (
        <View style={[styles.signalPill, { backgroundColor: theme.colors.surface.glass, borderColor: theme.colors.border }]}>
            <View style={[styles.signalIcon, { backgroundColor: `${tint}18`, borderColor: `${tint}30` }]}>
                <Ionicons name={icon} size={12} color={tint} />
            </View>
            <Text style={[styles.signalLabel, { color: theme.colors.text.secondary }]}>{label}</Text>
        </View>
    );
}

export default function SignInScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();
    const [isLoading, setIsLoading] = useState(false);
    const heroEntrance = useRef(new Animated.Value(0)).current;
    const panelEntrance = useRef(new Animated.Value(0)).current;
    const sheen = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.stagger(100, [
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
    }, [heroEntrance, panelEntrance, sheen]);

    const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: FormData) => {
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
        });
        setIsLoading(false);
        if (error) {
            Alert.alert('Sign In Failed', error.message);
        }
    };

    const heroStyle = {
        opacity: heroEntrance,
        transform: [
            { translateY: heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
        ],
    } as const;

    const panelStyle = {
        opacity: panelEntrance,
        transform: [
            { translateY: panelEntrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        ],
    } as const;

    const sheenStyle = {
        opacity: sheen.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.22, 0] }),
        transform: [
            { translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-260, 260] }) },
            { rotate: '-18deg' },
        ],
    } as const;

    const handlePrimaryPress = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handleSubmit(onSubmit)();
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <View style={styles.topRow}>
                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [
                                    styles.backBtn,
                                    {
                                        backgroundColor: theme.colors.surface.glassStrong,
                                        borderColor: theme.colors.border,
                                    },
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
                            </Pressable>
                            <ThemeModeToggle compact />
                        </View>

                        <Animated.View style={[styles.heroWrap, heroStyle]}>
                            <AuthBrand subtitle="Sign back in and keep your ratings, diary, and backlog momentum moving." />
                        </Animated.View>

                        <Animated.View style={panelStyle}>
                            <View style={styles.panelFrame}>
                                <BlurView
                                    intensity={theme.isDark ? 45 : 65}
                                    tint={theme.isDark ? 'dark' : 'light'}
                                    style={[
                                        styles.panel,
                                        {
                                            backgroundColor: theme.colors.surface.glassStrong,
                                            borderColor: theme.colors.border,
                                            shadowColor: theme.colors.surface.cardShadow,
                                        },
                                    ]}
                                >
                                    <Animated.View style={[styles.panelSheen, sheenStyle]}>
                                        <LinearGradient
                                            colors={['transparent', `${theme.colors.white}36`, 'transparent']}
                                            start={{ x: 0, y: 0.5 }}
                                            end={{ x: 1, y: 0.5 }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    </Animated.View>

                                    <View style={styles.headerRow}>
                                        <View style={[styles.headerBadge, { backgroundColor: `${theme.colors.hero.primary}18`, borderColor: `${theme.colors.hero.primary}36` }]}>
                                            <Ionicons name="log-in" size={20} color={theme.colors.hero.primary} />
                                        </View>
                                        <View style={styles.headerCopy}>
                                            <Text style={[styles.eyebrow, { color: theme.colors.text.secondary }]}>Returning Player</Text>
                                            <Text style={[styles.title, { color: theme.colors.text.primary }]}>Resume your quest</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                                        Everything you logged is waiting exactly where you left it.
                                    </Text>

                                    <View style={styles.signalRow}>
                                        <SignalPill icon="bookmark" label="Backlog synced" tint={theme.colors.hero.primary} />
                                        <SignalPill icon="star" label="Ratings ready" tint={theme.colors.hero.secondary} />
                                        <SignalPill icon="book" label="Diary intact" tint={theme.colors.hero.tertiary} />
                                    </View>

                                    <View style={styles.form}>
                                        <Controller
                                            control={control}
                                            name="email"
                                            render={({ field: { onChange, onBlur, value } }) => (
                                                <FormField
                                                    label="Email"
                                                    placeholder="you@example.com"
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    error={errors.email?.message}
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                />
                                            )}
                                        />
                                        <Controller
                                            control={control}
                                            name="password"
                                            render={({ field: { onChange, onBlur, value } }) => (
                                                <FormField
                                                    label="Password"
                                                    placeholder="Enter your password"
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    error={errors.password?.message}
                                                    secureTextEntry
                                                />
                                            )}
                                        />
                                    </View>

                                    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                                        <Pressable
                                            disabled={isLoading}
                                            onPressIn={() => Animated.spring(buttonScale, { toValue: 0.985, useNativeDriver: true, friction: 9 }).start()}
                                            onPressOut={() => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, friction: 9 }).start()}
                                            onPress={handlePrimaryPress}
                                            style={({ pressed }) => [pressed && styles.pressed]}
                                        >
                                            <LinearGradient
                                                colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                                            >
                                                <Text style={styles.submitButtonText}>{isLoading ? 'Signing In...' : 'Sign In'}</Text>
                                                <View style={[styles.submitButtonIcon, { backgroundColor: `${theme.colors.white}24` }]}>
                                                    <Ionicons
                                                        name={isLoading ? 'sync' : 'arrow-forward'}
                                                        size={16}
                                                        color={theme.colors.white}
                                                    />
                                                </View>
                                            </LinearGradient>
                                        </Pressable>
                                    </Animated.View>

                                    <View style={[styles.helperStrip, { backgroundColor: theme.colors.surface.glass, borderColor: theme.colors.border }]}>
                                        <Ionicons name="shield-checkmark" size={16} color={theme.colors.hero.quaternary} />
                                        <Text style={[styles.helperStripText, { color: theme.colors.text.secondary }]}>
                                            Use the same email tied to your player card.
                                        </Text>
                                    </View>

                                    <View style={styles.footer}>
                                        <Text style={[styles.footerText, { color: theme.colors.text.secondary }]}>Need an account?</Text>
                                        <Pressable onPress={() => router.replace('/(auth)/sign-up')}>
                                            <Text style={[styles.footerLink, { color: theme.colors.hero.secondary }]}>Create one</Text>
                                        </Pressable>
                                    </View>
                                </BlurView>
                            </View>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    safeArea: { flex: 1 },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 28,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    backBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroWrap: {
        marginTop: 2,
    },
    panelFrame: {
        borderRadius: 34,
        overflow: 'hidden',
        marginTop: 6,
    },
    panel: {
        borderRadius: 34,
        borderWidth: 1,
        padding: 22,
        overflow: 'hidden',
    },
    panelSheen: {
        position: 'absolute',
        width: 120,
        height: 380,
        top: -30,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    headerBadge: {
        width: 54,
        height: 54,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCopy: {
        flex: 1,
    },
    eyebrow: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    title: {
        fontSize: 30,
        lineHeight: 34,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.2,
    },
    subtitle: {
        marginTop: 14,
        fontSize: 15,
        lineHeight: 23,
        fontFamily: 'Inter_400Regular',
    },
    signalRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 18,
        marginBottom: 24,
    },
    signalPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    signalIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signalLabel: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    form: {
        gap: 18,
        marginBottom: 20,
    },
    submitButton: {
        minHeight: 64,
        borderRadius: 24,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    submitButtonDisabled: {
        opacity: 0.72,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 0.3,
    },
    submitButtonIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    helperStrip: {
        marginTop: 16,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    helperStripText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: 'Inter_400Regular',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
    },
    footerText: {
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
    },
    footerLink: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    pressed: {
        opacity: 0.9,
    },
});
