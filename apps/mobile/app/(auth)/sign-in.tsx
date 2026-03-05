import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Alert,
    KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { FormField } from '../../src/components/ui/FormField';
import { supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/styles/tokens';

const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function SignInScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
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
        // Auth listener in _layout.tsx handles redirect
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {/* Back */}
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Sign in to your account</Text>

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
                                    placeholder="••••••••"
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    error={errors.password?.message}
                                    secureTextEntry
                                />
                            )}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                        onPress={handleSubmit(onSubmit)}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.submitBtnText}>
                            {isLoading ? 'Signing in…' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
                            <Text style={styles.footerLink}>Create one</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    backBtn: { width: 44, height: 44, justifyContent: 'center', marginBottom: spacing.xl },
    title: { fontSize: typography.size['2xl'], fontFamily: 'Inter_700Bold', color: colors.text.primary },
    subtitle: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.xl },
    form: { gap: spacing.base, marginBottom: spacing.lg },
    submitBtn: {
        backgroundColor: colors.purple[600],
        borderRadius: radius.lg,
        paddingVertical: spacing.base + 2,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.white },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
    footerText: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary },
    footerLink: { fontSize: typography.size.base, fontFamily: 'Inter_600SemiBold', color: colors.purple[400] },
});
