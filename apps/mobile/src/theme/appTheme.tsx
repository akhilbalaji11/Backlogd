import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { colors as legacyColors, radius, spacing, typography, animation, STATUS_ICONS, STATUS_LABELS, PLATFORM_COLORS, GENRE_COLORS } from '../styles/tokens';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'backlogd-theme-mode';

const darkColors = {
    bg: {
        primary: '#070914',
        secondary: '#0d1324',
        tertiary: '#141b31',
        card: '#151e35',
        elevated: '#1a2644',
    },
    neon: {
        cyan: '#52f3ff',
        cyanDim: '#1896b7',
        pink: '#ff4f8b',
        pinkDim: '#c73669',
        lime: '#9afc7b',
        limeDim: '#39a76a',
        purple: '#9b7bff',
        purpleDim: '#664be8',
        orange: '#ff9b54',
        blue: '#4d8dff',
    },
    purple: legacyColors.purple,
    rose: legacyColors.rose,
    text: {
        primary: '#f7fbff',
        secondary: '#b4c2dd',
        muted: '#6c7a99',
        dim: '#42516f',
    },
    status: {
        played: '#7cf59a',
        playing: '#53f2ff',
        backlog: '#ffc857',
        wishlist: '#ff5c93',
    },
    star: '#ffd166',
    starEmpty: '#42516f',
    border: '#223152',
    borderLight: '#31456f',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    glow: {
        cyan: 'rgba(82, 243, 255, 0.35)',
        pink: 'rgba(255, 79, 139, 0.35)',
        lime: 'rgba(154, 252, 123, 0.30)',
        purple: 'rgba(155, 123, 255, 0.32)',
    },
    gradients: {
        hero: ['rgba(7, 9, 20, 0)', 'rgba(7, 9, 20, 0.74)', '#070914'],
        cardShine: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'],
        neonCyan: ['#52f3ff', '#2d7dff'],
        neonPink: ['#ff4f8b', '#ff8a5b'],
        neonPurple: ['#9b7bff', '#5e5bff'],
    },
    surface: {
        glass: 'rgba(22, 31, 56, 0.72)',
        glassStrong: 'rgba(18, 25, 46, 0.86)',
        overlay: 'rgba(6, 10, 18, 0.74)',
        cardShadow: 'rgba(5, 8, 18, 0.45)',
    },
    hero: {
        primary: '#4d8dff',
        secondary: '#9b7bff',
        tertiary: '#ff5c93',
        quaternary: '#9afc7b',
    },
};

const lightColors = {
    bg: {
        primary: '#f6f8ff',
        secondary: '#eef3ff',
        tertiary: '#e4ebff',
        card: '#fbfcff',
        elevated: '#ffffff',
    },
    neon: {
        cyan: '#0ea5e9',
        cyanDim: '#0b6e9b',
        pink: '#e11d74',
        pinkDim: '#b11e61',
        lime: '#2fbf71',
        limeDim: '#208957',
        purple: '#7c3aed',
        purpleDim: '#5b21b6',
        orange: '#f97316',
        blue: '#2563eb',
    },
    purple: legacyColors.purple,
    rose: legacyColors.rose,
    text: {
        primary: '#101a33',
        secondary: '#51607f',
        muted: '#7b89a7',
        dim: '#9ca8c0',
    },
    status: {
        played: '#169b62',
        playing: '#0284c7',
        backlog: '#e98f00',
        wishlist: '#db2777',
    },
    star: '#f59e0b',
    starEmpty: '#c6d0e7',
    border: '#d7def0',
    borderLight: '#c2ccdf',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    glow: {
        cyan: 'rgba(14, 165, 233, 0.22)',
        pink: 'rgba(225, 29, 116, 0.18)',
        lime: 'rgba(47, 191, 113, 0.18)',
        purple: 'rgba(124, 58, 237, 0.20)',
    },
    gradients: {
        hero: ['rgba(246, 248, 255, 0)', 'rgba(246, 248, 255, 0.65)', '#f6f8ff'],
        cardShine: ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.02)'],
        neonCyan: ['#68d7ff', '#6f7cff'],
        neonPink: ['#ff7ab6', '#ffb86b'],
        neonPurple: ['#8b5cf6', '#3b82f6'],
    },
    surface: {
        glass: 'rgba(255, 255, 255, 0.72)',
        glassStrong: 'rgba(255, 255, 255, 0.9)',
        overlay: 'rgba(240, 244, 255, 0.74)',
        cardShadow: 'rgba(77, 96, 142, 0.16)',
    },
    hero: {
        primary: '#6ea8ff',
        secondary: '#9e8cff',
        tertiary: '#ff8db2',
        quaternary: '#7cdca5',
    },
};

export type AppTheme = {
    mode: ThemeMode;
    isDark: boolean;
    colors: typeof darkColors;
    spacing: typeof spacing;
    radius: typeof radius;
    typography: typeof typography;
    animation: typeof animation;
    statusLabels: typeof STATUS_LABELS;
    statusIcons: typeof STATUS_ICONS;
    platformColors: typeof PLATFORM_COLORS;
    genreColors: typeof GENRE_COLORS;
};

type ThemeContextValue = {
    theme: AppTheme;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    toggleMode: () => void;
    isLoaded: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(mode: ThemeMode): AppTheme {
    return {
        mode,
        isDark: mode === 'dark',
        colors: mode === 'dark' ? darkColors : lightColors,
        spacing,
        radius,
        typography,
        animation,
        statusLabels: STATUS_LABELS,
        statusIcons: STATUS_ICONS,
        platformColors: PLATFORM_COLORS,
        genreColors: GENRE_COLORS,
    };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setModeState] = useState<ThemeMode>('dark');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;

        SecureStore.getItemAsync(STORAGE_KEY)
            .then((value) => {
                if (!mounted) return;
                if (value === 'dark' || value === 'light') {
                    setModeState(value);
                }
            })
            .finally(() => {
                if (mounted) setIsLoaded(true);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const setMode = (nextMode: ThemeMode) => {
        setModeState(nextMode);
        SecureStore.setItemAsync(STORAGE_KEY, nextMode).catch(() => undefined);
    };

    const toggleMode = () => {
        setMode(mode === 'dark' ? 'light' : 'dark');
    };

    const value = useMemo<ThemeContextValue>(() => ({
        theme: buildTheme(mode),
        mode,
        setMode,
        toggleMode,
        isLoaded,
    }), [isLoaded, mode]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useAppTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useAppTheme must be used within ThemeProvider');
    }
    return context;
}
