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
                    theme.colors.bg.tertiary,
                    theme.colors.bg.primary,
                ]}
                style={StyleSheet.absoluteFill}
            />
            <LinearGradient
                colors={[
                    `${theme.colors.hero.quaternary}${theme.isDark ? '18' : '22'}`,
                    `${theme.colors.hero.primary}${theme.isDark ? '12' : '16'}`,
                    'transparent',
                ]}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 0.75 }}
                style={styles.lightSweep}
            />
            <View style={[styles.orb, styles.orbTop, { backgroundColor: theme.colors.hero.primary, opacity: theme.isDark ? 0.2 : 0.14 }]} />
            <View style={[styles.orb, styles.orbMiddle, { backgroundColor: theme.colors.hero.secondary, opacity: theme.isDark ? 0.16 : 0.12 }]} />
            <View style={[styles.orb, styles.orbBottom, { backgroundColor: theme.colors.hero.quaternary, opacity: theme.isDark ? 0.22 : 0.16 }]} />
            <View style={[styles.sparkBar, styles.sparkBarLeft, { backgroundColor: `${theme.colors.hero.secondary}${theme.isDark ? '10' : '0E'}` }]} />
            <View style={[styles.sparkBar, styles.sparkBarRight, { backgroundColor: `${theme.colors.hero.primary}${theme.isDark ? '12' : '10'}` }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    lightSweep: {
        ...StyleSheet.absoluteFillObject,
    },
    orb: {
        position: 'absolute',
        borderRadius: 999,
    },
    orbTop: {
        width: 300,
        height: 300,
        top: -110,
        right: -90,
    },
    orbMiddle: {
        width: 230,
        height: 230,
        left: -80,
        top: '30%',
    },
    orbBottom: {
        width: 280,
        height: 280,
        right: -90,
        bottom: -90,
    },
    sparkBar: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 40,
        transform: [{ rotate: '36deg' }],
    },
    sparkBarLeft: {
        left: -95,
        bottom: '18%',
    },
    sparkBarRight: {
        right: -120,
        top: '18%',
    },
});
