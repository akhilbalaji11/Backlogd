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
import { useAuthStore } from '../../src/stores/authStore';
import { useAppTheme } from '../../src/theme/appTheme';

const schema = z.object({
    displayName: z.string().min(2, 'Name must be at least 2 characters').max(30),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function StepChip({ index, label, active }: { index: number; label: string; active: boolean }) {
    const { theme } = useAppTheme();

    return (
        <View
            style={[
                styles.stepChip,
                {
                    backgroundColor: active ? `${theme.colors.hero.secondary}18` : theme.colors.surface.glass,
                    borderColor: active ? `${theme.colors.hero.secondary}44` : theme.colors.border,
                },
            ]}
        >
            <View
                style={[
                    styles.stepIndex,
                    {
                        backgroundColor: active ? theme.colors.hero.secondary : theme.colors.surface.glassStrong,
                        borderColor: active ? theme.colors.hero.secondary : theme.colors.border,
                    },
                ]}
            >
                <Text style={[styles.stepIndexText, { color: active ? theme.colors.white : theme.colors.text.secondary }]}>{index}</Text>
            </View>
            <Text style={[styles.stepLabel, { color: active ? theme.colors.text.primary : theme.colors.text.secondary }]}>{label}</Text>
        </View>
    );
}

export default function SignUpScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();
    const { setPendingSignup } = useAuthStore();
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
            displayName: '',
            email: '',
            password: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (data: FormData) => {
        setIsLoading(true);
        const { error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: { display_name: data.displayName },
            },
        });
        setIsLoading(false);
        if (error) {
            Alert.alert('Sign Up Failed', error.message);
            return;
        }

        setPendingSignup({
            email: data.email,
            password: data.password,
        });

        router.replace('/(auth)/profile-setup');
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
                            <AuthBrand subtitle="Create your profile, shape your shelves, and start logging what actually defines your taste." />
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
                                        <View style={[styles.headerBadge, { backgroundColor: `${theme.colors.hero.secondary}18`, borderColor: `${theme.colors.hero.secondary}36` }]}>
                                            <Ionicons name="sparkles" size={20} color={theme.colors.hero.secondary} />
                                        </View>
                                        <View style={styles.headerCopy}>
                                            <Text style={[styles.eyebrow, { color: theme.colors.text.secondary }]}>New Profile</Text>
                                            <Text style={[styles.title, { color: theme.colors.text.primary }]}>Build your player card</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                                        One account now, then you are straight into ratings, lists, reviews, and profile setup.
                                    </Text>

                                    <View style={styles.stepsRow}>
                                        <StepChip index={1} label="Account" active />
                                        <StepChip index={2} label="Profile" active />
                                        <StepChip index={3} label="Start logging" active={false} />
                                    </View>

                                    <View style={styles.form}>
                                        <Controller
                                            control={control}
                                            name="displayName"
                                            render={({ field: { onChange, onBlur, value } }) => (
                                                <FormField
                                                    label="Display Name"
                                                    placeholder="Your gamer tag"
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    error={errors.displayName?.message}
                                                    autoCapitalize="words"
                                                />
                                            )}
                                        />
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
                                                    placeholder="Minimum 8 characters"
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    error={errors.password?.message}
                                                    secureTextEntry
                                                />
                                            )}
                                        />
                                        <Controller
                                            control={control}
                                            name="confirmPassword"
                                            render={({ field: { onChange, onBlur, value } }) => (
                                                <FormField
                                                    label="Confirm Password"
                                                    placeholder="Repeat your password"
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    error={errors.confirmPassword?.message}
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
                                                colors={[theme.colors.hero.secondary, theme.colors.hero.tertiary, theme.colors.hero.quaternary]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                                            >
                                                <Text style={styles.submitButtonText}>{isLoading ? 'Creating Account...' : 'Create Account'}</Text>
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
                                        <Ionicons name="flash" size={16} color={theme.colors.hero.quaternary} />
                                        <Text style={[styles.helperStripText, { color: theme.colors.text.secondary }]}>
                                            Next step after this: personalize your profile and jump into the app.
                                        </Text>
                                    </View>

                                    <View style={styles.footer}>
                                        <Text style={[styles.footerText, { color: theme.colors.text.secondary }]}>Already have an account?</Text>
                                        <Pressable onPress={() => router.replace('/(auth)/sign-in')}>
                                            <Text style={[styles.footerLink, { color: theme.colors.hero.secondary }]}>Sign In</Text>
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
        height: 460,
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
        fontSize: 29,
        lineHeight: 33,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1.2,
    },
    subtitle: {
        marginTop: 14,
        fontSize: 15,
        lineHeight: 23,
        fontFamily: 'Inter_400Regular',
    },
    stepsRow: {
        gap: 10,
        marginTop: 18,
        marginBottom: 24,
    },
    stepChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    stepIndex: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepIndexText: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
    },
    stepLabel: {
        fontSize: 13,
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
