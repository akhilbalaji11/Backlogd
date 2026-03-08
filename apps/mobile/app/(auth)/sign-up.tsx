import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { FormField } from '../../src/components/ui/FormField';
import { ThemeBackdrop } from '../../src/components/ui/ThemeBackdrop';
import { ThemeModeToggle } from '../../src/components/ui/ThemeModeToggle';
import { supabase } from '../../src/lib/supabase';
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

function ProgressPill({ active }: { active: boolean }) {
    const { theme } = useAppTheme();
    return (
        <View
            style={[
                styles.progressPill,
                {
                    backgroundColor: active ? theme.colors.hero.secondary : theme.colors.surface.glass,
                    borderColor: active ? theme.colors.hero.secondary : theme.colors.border,
                },
            ]}
        />
    );
}

export default function SignUpScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();
    const [isLoading, setIsLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 380,
            useNativeDriver: true,
        }).start();
    }, []);

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
        router.replace('/(auth)/profile-setup');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <View style={styles.topRow}>
                            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                                <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
                            </TouchableOpacity>
                            <ThemeModeToggle compact />
                        </View>

                        <Animated.View
                            style={[
                                styles.panel,
                                {
                                    opacity: fadeAnim,
                                    backgroundColor: theme.colors.surface.glassStrong,
                                    borderColor: theme.colors.border,
                                    shadowColor: theme.colors.surface.cardShadow,
                                },
                            ]}
                        >
                            <View style={[styles.headerBadge, { backgroundColor: `${theme.colors.hero.secondary}18`, borderColor: `${theme.colors.hero.secondary}38` }]}>
                                <Ionicons name="sparkles" size={22} color={theme.colors.hero.secondary} />
                            </View>
                            <Text style={[styles.title, { color: theme.colors.text.primary }]}>Build Your Player Card</Text>
                            <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                                Create your account and start logging the games that actually define your taste.
                            </Text>

                            <View style={styles.progressRow}>
                                <ProgressPill active />
                                <ProgressPill active />
                                <ProgressPill active={false} />
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

                            <TouchableOpacity onPress={handleSubmit(onSubmit)} disabled={isLoading} activeOpacity={0.92}>
                                <LinearGradient
                                    colors={[theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                                >
                                    <View style={styles.submitButtonContent}>
                                        {isLoading && <Ionicons name="sync" size={16} color={theme.colors.white} />}
                                        <Text style={styles.submitButtonText}>{isLoading ? 'Creating Account...' : 'Create Account'}</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.footer}>
                                <Text style={[styles.footerText, { color: theme.colors.text.secondary }]}>Already have an account?</Text>
                                <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
                                    <Text style={[styles.footerLink, { color: theme.colors.hero.secondary }]}>Sign In</Text>
                                </TouchableOpacity>
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
    safeArea: { flex: 1 },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 24,
        justifyContent: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    backBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
    },
    panel: {
        borderRadius: 30,
        borderWidth: 1,
        padding: 24,
        justifyContent: 'center',
    },
    headerBadge: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: 18,
    },
    title: {
        fontSize: 29,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1,
    },
    subtitle: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
    },
    progressRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
        marginBottom: 22,
    },
    progressPill: {
        flex: 1,
        height: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    form: {
        gap: 18,
        marginBottom: 24,
    },
    submitButton: {
        borderRadius: 20,
        paddingVertical: 18,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.72,
    },
    submitButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        letterSpacing: 0.3,
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
});
