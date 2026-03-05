import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../styles/tokens';

interface FormFieldProps extends TextInputProps {
    label: string;
    error?: string;
}

export function FormField({ label, error, secureTextEntry, ...props }: FormFieldProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
                <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.text.muted}
                    selectionColor={colors.purple[400]}
                    secureTextEntry={secureTextEntry && !showPassword}
                    {...props}
                />
                {secureTextEntry && (
                    <TouchableOpacity
                        onPress={() => setShowPassword((v) => !v)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off' : 'eye'}
                            size={18}
                            color={colors.text.muted}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xs },
    label: {
        fontSize: typography.size.sm,
        fontFamily: 'Inter_500Medium',
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg.secondary,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: spacing.base,
    },
    inputError: { borderColor: colors.rose[500] },
    input: {
        flex: 1,
        fontSize: typography.size.base,
        fontFamily: 'Inter_400Regular',
        color: colors.text.primary,
        paddingVertical: spacing.md,
        minHeight: 52,
    },
    eyeBtn: { padding: spacing.xs },
    errorText: {
        fontSize: typography.size.xs,
        fontFamily: 'Inter_400Regular',
        color: colors.rose[400],
    },
});
