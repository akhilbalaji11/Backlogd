import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Alert,
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
import type { Platform } from '../../src/domain/types';
import { profilesRepo } from '../../src/lib/profilesRepo';
import { useAuthStore } from '../../src/stores/authStore';
import { useAppTheme } from '../../src/theme/appTheme';

const PLATFORMS: Platform[] = ['PS5', 'Xbox', 'Switch', 'PC', 'PS4', 'iOS', 'Android'];

const schema = z.object({
    displayName: z.string().min(2, 'Name must be at least 2 characters').max(30),
    bio: z.string().max(160).optional(),
});

type FormData = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
    const router = useRouter();
    const { user, setProfile } = useAuthStore();
    const { theme } = useAppTheme();
    const styles = createStyles(theme);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { displayName: '' },
    });

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images' as const,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatarUri(result.assets[0].uri);
        }
    };

    const togglePlatform = (platform: Platform) => {
        setSelectedPlatforms((prev) =>
            prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform]
        );
    };

    const onSubmit = async (data: FormData) => {
        if (!user) return;

        setIsLoading(true);
        try {
            let avatarUrl: string | undefined;

            if (avatarUri) {
                try {
                    avatarUrl = await profilesRepo.uploadAvatar(user.id, avatarUri);
                } catch (uploadErr: any) {
                    console.warn('[Profile] Avatar upload failed, continuing without it:', uploadErr.message);
                }
            }

            const profile = await profilesRepo.upsert({
                id: user.id,
                displayName: data.displayName,
                bio: data.bio,
                avatarUrl,
                favoritePlatforms: selectedPlatforms,
            });

            setProfile(profile);
            router.replace('/(tabs)/discover');
        } catch (err: any) {
            console.error('[Profile] Save failed:', err);
            Alert.alert('Error', err.message ?? 'Could not save profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
            <ThemeBackdrop />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View style={styles.topRow}>
                        <View style={styles.progressPill}>
                            <Ionicons name="sparkles" size={13} color={theme.colors.hero.quaternary} />
                            <Text style={styles.progressText}>Final setup</Text>
                        </View>
                        <ThemeModeToggle compact />
                    </View>

                    <LinearGradient
                        colors={[theme.colors.hero.primary, theme.colors.hero.secondary, theme.colors.hero.tertiary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroCard}
                    >
                        <Text style={styles.heroEyebrow}>Player Profile</Text>
                        <Text style={styles.heroTitle}>Build your gamer card</Text>
                        <Text style={styles.heroCopy}>
                            Add a name, a short vibe check, and your platforms so the app can feel like it belongs to you.
                        </Text>
                    </LinearGradient>

                    <View style={styles.avatarSection}>
                        <TouchableOpacity style={styles.avatarShell} onPress={pickAvatar} activeOpacity={0.9}>
                            <LinearGradient
                                colors={[theme.colors.hero.secondary, theme.colors.hero.primary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.avatarRing}
                            >
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" transition={150} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Ionicons name="person" size={34} color={theme.colors.white} />
                                    </View>
                                )}
                            </LinearGradient>
                            <View style={styles.avatarBadge}>
                                <Ionicons name="camera" size={14} color={theme.colors.white} />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.avatarLabel}>Tap to add an avatar</Text>
                    </View>

                    <View style={styles.formCard}>
                        <Controller
                            control={control}
                            name="displayName"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <FormField
                                    label="Display Name"
                                    placeholder="Your gamer name"
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
                            name="bio"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <FormField
                                    label="Bio"
                                    placeholder="What kind of games do you love?"
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    error={errors.bio?.message}
                                    multiline
                                    numberOfLines={3}
                                />
                            )}
                        />
                    </View>

                    <View style={styles.platformCard}>
                        <View style={styles.platformHeader}>
                            <Text style={styles.platformLabel}>Favorite Platforms</Text>
                            <Text style={styles.platformCopy}>Pick the hardware that actually gets your time.</Text>
                        </View>
                        <View style={styles.platformGrid}>
                            {PLATFORMS.map((platform) => {
                                const active = selectedPlatforms.includes(platform);
                                return (
                                    <TouchableOpacity
                                        key={platform}
                                        style={active ? styles.platformChipActive : styles.platformChip}
                                        onPress={() => togglePlatform(platform)}
                                        activeOpacity={0.88}
                                    >
                                        <Text style={active ? styles.platformTextActive : styles.platformText}>{platform}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, isLoading ? styles.primaryButtonDisabled : null]}
                        onPress={handleSubmit(onSubmit)}
                        disabled={isLoading}
                        activeOpacity={0.88}
                    >
                        <LinearGradient
                            colors={[theme.colors.hero.primary, theme.colors.hero.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.primaryGradient}
                        >
                            <Ionicons name="rocket" size={18} color={theme.colors.white} />
                            <Text style={styles.primaryText}>{isLoading ? 'Saving...' : "Launch Backlogd"}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)/discover')}>
                        <Text style={styles.skipText}>Skip for now</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme']) => StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 110,
        gap: 18,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: theme.colors.surface.glassStrong,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    progressText: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    heroCard: {
        borderRadius: 30,
        padding: 24,
    },
    heroEyebrow: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.white,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroTitle: {
        marginTop: 12,
        fontSize: 32,
        lineHeight: 36,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.white,
        maxWidth: 260,
    },
    heroCopy: {
        marginTop: 10,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
        color: 'rgba(255,255,255,0.84)',
        maxWidth: 320,
    },
    avatarSection: {
        alignItems: 'center',
        marginTop: 4,
    },
    avatarShell: {
        position: 'relative',
    },
    avatarRing: {
        width: 124,
        height: 124,
        borderRadius: 62,
        padding: 4,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 58,
    },
    avatarPlaceholder: {
        flex: 1,
        borderRadius: 58,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    avatarBadge: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: theme.colors.hero.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: theme.colors.bg.primary,
    },
    avatarLabel: {
        marginTop: 12,
        fontSize: 13,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.secondary,
    },
    formCard: {
        gap: 14,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 20,
    },
    platformCard: {
        borderRadius: 28,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface.glassStrong,
        padding: 20,
    },
    platformHeader: {
        marginBottom: 14,
    },
    platformLabel: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    platformCopy: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.text.secondary,
    },
    platformGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    platformChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
        backgroundColor: theme.colors.bg.secondary,
    },
    platformChipActive: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: `${theme.colors.hero.secondary}44`,
        backgroundColor: `${theme.colors.hero.secondary}22`,
    },
    platformText: {
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.text.secondary,
    },
    platformTextActive: {
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.hero.secondary,
    },
    primaryButton: {
        borderRadius: 24,
        overflow: 'hidden',
        marginTop: 4,
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryGradient: {
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    primaryText: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        color: theme.colors.white,
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    skipText: {
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
        color: theme.colors.text.muted,
    },
});
