import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '../../theme/appTheme';

interface FormFieldProps extends TextInputProps {
    label: string;
    error?: string;
}

export function FormField({ label, error, secureTextEntry, onFocus, onBlur, value, ...props }: FormFieldProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const { theme } = useAppTheme();
    const normalizedValue =
        typeof value === 'string'
            ? value
            : value == null
                ? ''
                : String(value);

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{label}</Text>
            <View
                style={[
                    styles.inputWrapper,
                    {
                        backgroundColor: theme.colors.surface.glassStrong,
                        borderColor: theme.colors.border,
                        shadowColor: theme.colors.surface.cardShadow,
                    },
                    error
                        ? { borderColor: theme.colors.neon.pink, shadowColor: theme.colors.neon.pink, shadowOpacity: 0.16, shadowRadius: 10 }
                        : isFocused
                            ? { borderColor: theme.colors.hero.primary, shadowColor: theme.colors.hero.primary, shadowOpacity: 0.16, shadowRadius: 12 }
                            : null,
                ]}
            >
                <TextInput
                    {...props}
                    style={[styles.input, { color: theme.colors.text.primary }]}
                    value={normalizedValue}
                    placeholderTextColor={theme.colors.text.muted}
                    selectionColor={theme.colors.hero.primary}
                    secureTextEntry={secureTextEntry && !showPassword}
                    onFocus={(event) => {
                        setIsFocused(true);
                        onFocus?.(event);
                    }}
                    onBlur={(event) => {
                        setIsFocused(false);
                        onBlur?.(event);
                    }}
                />
                {secureTextEntry && (
                    <TouchableOpacity
                        onPress={() => setShowPassword((value) => !value)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off' : 'eye'}
                            size={18}
                            color={isFocused ? theme.colors.hero.primary : theme.colors.text.muted}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={12} color={theme.colors.neon.pink} />
                    <Text style={[styles.errorText, { color: theme.colors.neon.pink }]}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 6,
    },
    label: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1.5,
        paddingHorizontal: 18,
    },
    input: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        paddingVertical: 15,
        minHeight: 56,
    },
    eyeBtn: {
        padding: 4,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    errorText: {
        fontSize: 11,
        fontFamily: 'Inter_500Medium',
    },
});
