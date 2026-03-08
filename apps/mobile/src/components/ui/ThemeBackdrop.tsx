import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../../theme/appTheme';

export function ThemeBackdrop() {
    const { theme } = useAppTheme();

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient
                colors={[
                    theme.colors.bg.primary,
                    theme.colors.bg.secondary,
                    theme.colors.bg.primary,
                ]}
                style={StyleSheet.absoluteFill}
            />
            <View style={[styles.orb, styles.orbTop, { backgroundColor: theme.colors.hero.primary, opacity: theme.isDark ? 0.22 : 0.18 }]} />
            <View style={[styles.orb, styles.orbMiddle, { backgroundColor: theme.colors.hero.secondary, opacity: theme.isDark ? 0.18 : 0.16 }]} />
            <View style={[styles.orb, styles.orbBottom, { backgroundColor: theme.colors.hero.tertiary, opacity: theme.isDark ? 0.16 : 0.14 }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    orb: {
        position: 'absolute',
        borderRadius: 999,
    },
    orbTop: {
        width: 260,
        height: 260,
        top: -90,
        right: -80,
    },
    orbMiddle: {
        width: 220,
        height: 220,
        left: -90,
        top: '34%',
    },
    orbBottom: {
        width: 240,
        height: 240,
        right: -70,
        bottom: -70,
    },
});
