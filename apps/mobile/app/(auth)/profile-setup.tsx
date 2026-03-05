import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
    Alert, Image,
    ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { FormField } from '../../src/components/ui/FormField';
import type { Platform } from '../../src/domain/types';
import { profilesRepo } from '../../src/lib/profilesRepo';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, radius, spacing, typography } from '../../src/styles/tokens';

const PLATFORMS: Platform[] = ['PS5', 'Xbox', 'Switch', 'PC', 'PS4', 'iOS', 'Android'];

const schema = z.object({
    displayName: z.string().min(2, 'Name must be at least 2 characters').max(30),
    bio: z.string().max(160).optional(),
});
type FormData = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
    const router = useRouter();
    const { user, setProfile } = useAuthStore();
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
        if (!result.canceled) setAvatarUri(result.assets[0].uri);
    };

    const togglePlatform = (p: Platform) => {
        setSelectedPlatforms((prev) =>
            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
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
                    // Don't block profile save on avatar upload failure
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
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Set up your profile</Text>
                <Text style={styles.subtitle}>Tell the community a bit about yourself</Text>

                {/* Avatar picker */}
                <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar}>
                    {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person-add" size={32} color={colors.purple[400]} />
                        </View>
                    )}
                    <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={14} color={colors.white} />
                    </View>
                </TouchableOpacity>

                <View style={styles.form}>
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
                                label="Bio (optional)"
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

                {/* Platform selection */}
                <Text style={styles.sectionLabel}>Favorite Platforms</Text>
                <View style={styles.platforms}>
                    {PLATFORMS.map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.platformChip, selectedPlatforms.includes(p) && styles.platformChipActive]}
                            onPress={() => togglePlatform(p)}
                        >
                            <Text style={[styles.platformText, selectedPlatforms.includes(p) && styles.platformTextActive]}>
                                {p}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.submitBtn, isLoading && { opacity: 0.6 }]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading}
                >
                    <Text style={styles.submitBtnText}>
                        {isLoading ? 'Saving…' : "Let's Go!"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => router.replace('/(tabs)/discover')}
                >
                    <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg.primary },
    scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
    title: { fontSize: typography.size['2xl'], fontFamily: 'Inter_700Bold', color: colors.text.primary, textAlign: 'center' },
    subtitle: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
    avatarContainer: { alignSelf: 'center', marginBottom: spacing.xl, position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: colors.bg.tertiary,
        borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
        alignItems: 'center', justifyContent: 'center',
    },
    avatarBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.purple[600],
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: colors.bg.primary,
    },
    form: { gap: spacing.base, marginBottom: spacing.lg },
    sectionLabel: {
        fontSize: typography.size.sm, fontFamily: 'Inter_500Medium',
        color: colors.text.secondary, textTransform: 'uppercase',
        letterSpacing: 0.5, marginBottom: spacing.sm,
    },
    platforms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
    platformChip: {
        paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
        borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
        backgroundColor: colors.bg.secondary,
    },
    platformChipActive: { backgroundColor: colors.purple[600], borderColor: colors.purple[500] },
    platformText: { fontSize: typography.size.sm, fontFamily: 'Inter_500Medium', color: colors.text.secondary },
    platformTextActive: { color: colors.white },
    submitBtn: {
        backgroundColor: colors.purple[600],
        borderRadius: radius.lg,
        paddingVertical: spacing.base + 2,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    submitBtnText: { fontSize: typography.size.md, fontFamily: 'Inter_600SemiBold', color: colors.white },
    skipBtn: { alignItems: 'center', padding: spacing.sm },
    skipText: { fontSize: typography.size.base, fontFamily: 'Inter_400Regular', color: colors.text.muted },
});
