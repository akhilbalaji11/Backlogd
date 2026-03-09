import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../theme/appTheme';

export function ThemeModeToggle({ compact = false }: { compact?: boolean }) {
    const { mode, toggleMode, theme } = useAppTheme();
    const isDark = mode === 'dark';

    return (
        <Pressable
            onPress={toggleMode}
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surface.glassStrong,
                    borderColor: theme.colors.border,
                    shadowColor: theme.colors.surface.cardShadow,
                },
                compact && styles.containerCompact,
            ]}
        >
            <View style={[styles.trackGlow, { backgroundColor: `${theme.colors.hero.primary}10` }]} />
            <View
                style={[
                    styles.thumb,
                    {
                        backgroundColor: isDark ? theme.colors.hero.secondary : theme.colors.hero.primary,
                        alignSelf: isDark ? 'flex-end' : 'flex-start',
                        shadowColor: theme.colors.surface.cardShadow,
                    },
                ]}
            >
                <Ionicons
                    name={isDark ? 'moon' : 'sunny'}
                    size={compact ? 14 : 16}
                    color={theme.colors.white}
                />
            </View>
            {!compact && (
                <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        minWidth: 110,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        padding: 4,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    containerCompact: {
        minWidth: 54,
        width: 54,
    },
    trackGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 23,
    },
    thumb: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 3,
    },
    label: {
        position: 'absolute',
        left: 14,
        right: 14,
        textAlign: 'center',
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
        letterSpacing: 0.3,
    },
});
