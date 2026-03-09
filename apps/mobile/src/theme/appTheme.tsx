import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { radius, spacing, typography, animation, STATUS_ICONS, STATUS_LABELS, PLATFORM_COLORS, GENRE_COLORS } from '../styles/tokens';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'backlogd-theme-mode';

type WebStorageLike = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
};

function getWebStorage(): WebStorageLike | null {
    if (Platform.OS !== 'web') return null;

    const candidate = globalThis as typeof globalThis & { localStorage?: WebStorageLike };
    return candidate.localStorage ?? null;
}

async function readStoredMode(): Promise<ThemeMode | null> {
    const storage = getWebStorage();
    if (storage) {
        try {
            const value = storage.getItem(STORAGE_KEY);
            return value === 'dark' || value === 'light' ? value : null;
        } catch {
            return null;
        }
    }

    try {
        const value = await SecureStore.getItemAsync(STORAGE_KEY);
        return value === 'dark' || value === 'light' ? value : null;
    } catch {
        return null;
    }
}

function persistMode(nextMode: ThemeMode) {
    const storage = getWebStorage();
    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, nextMode);
        } catch {
            return;
        }
        return;
    }

    SecureStore.setItemAsync(STORAGE_KEY, nextMode).catch(() => undefined);
}

const darkColors = {
    bg: {
        primary: '#130d09',
        secondary: '#1c140f',
        tertiary: '#261913',
        card: '#2d1e17',
        elevated: '#37241b',
    },
    neon: {
        cyan: '#efd1a1',
        cyanDim: '#b78c54',
        pink: '#db8163',
        pinkDim: '#a65a44',
        lime: '#d6b36f',
        limeDim: '#9e7842',
        purple: '#b16a4c',
        purpleDim: '#7b432f',
        orange: '#f29f57',
        blue: '#c7874c',
    },
    purple: {
        300: '#f2d5b2',
        400: '#e7b47e',
        500: '#d38a55',
        600: '#b9643e',
        700: '#8c4932',
    },
    rose: {
        400: '#e6a07b',
        500: '#c56b50',
    },
    text: {
        primary: '#fff7ef',
        secondary: '#d4c0ac',
        muted: '#a8876e',
        dim: '#705644',
    },
    status: {
        played: '#d8c06d',
        playing: '#f1a45f',
        backlog: '#cf7447',
        wishlist: '#f2dfbd',
    },
    star: '#f2c77a',
    starEmpty: '#705644',
    border: '#4f382a',
    borderLight: '#6a4b38',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    glow: {
        cyan: 'rgba(239, 209, 161, 0.34)',
        pink: 'rgba(219, 129, 99, 0.32)',
        lime: 'rgba(214, 179, 111, 0.26)',
        purple: 'rgba(177, 106, 76, 0.28)',
    },
    gradients: {
        hero: ['rgba(19, 13, 9, 0)', 'rgba(19, 13, 9, 0.74)', '#130d09'],
        cardShine: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'],
        neonCyan: ['#f2d29f', '#d18a4d'],
        neonPink: ['#e69b77', '#bb6446'],
        neonPurple: ['#f5dfbf', '#d27d4a'],
    },
    surface: {
        glass: 'rgba(57, 38, 25, 0.66)',
        glassStrong: 'rgba(38, 24, 15, 0.84)',
        overlay: 'rgba(14, 8, 5, 0.72)',
        cardShadow: 'rgba(8, 4, 2, 0.42)',
    },
    hero: {
        primary: '#f2be72',
        secondary: '#d98952',
        tertiary: '#a95a3f',
        quaternary: '#f3e1bf',
    },
};

const lightColors = {
    bg: {
        primary: '#fbf4ea',
        secondary: '#f4e9da',
        tertiary: '#ecdecd',
        card: '#fff9f0',
        elevated: '#fffdf8',
    },
    neon: {
        cyan: '#d3a055',
        cyanDim: '#9d6f2d',
        pink: '#c76b4f',
        pinkDim: '#944834',
        lime: '#b88c45',
        limeDim: '#8a6530',
        purple: '#a45d43',
        purpleDim: '#7a4130',
        orange: '#dc8440',
        blue: '#ae7040',
    },
    purple: {
        300: '#f3d6b8',
        400: '#e6b07d',
        500: '#cb8551',
        600: '#ad633f',
        700: '#7d472f',
    },
    rose: {
        400: '#da8f6e',
        500: '#bb6549',
    },
    text: {
        primary: '#2f1c12',
        secondary: '#725646',
        muted: '#9f836e',
        dim: '#c2a891',
    },
    status: {
        played: '#9d7a2d',
        playing: '#c66d2b',
        backlog: '#a75135',
        wishlist: '#b28d68',
    },
    star: '#d29438',
    starEmpty: '#d9c3ae',
    border: '#deccb6',
    borderLight: '#ceb59a',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    glow: {
        cyan: 'rgba(211, 160, 85, 0.22)',
        pink: 'rgba(199, 107, 79, 0.18)',
        lime: 'rgba(184, 140, 69, 0.16)',
        purple: 'rgba(164, 93, 67, 0.18)',
    },
    gradients: {
        hero: ['rgba(251, 244, 234, 0)', 'rgba(251, 244, 234, 0.68)', '#fbf4ea'],
        cardShine: ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.02)'],
        neonCyan: ['#efc98f', '#d58a47'],
        neonPink: ['#df9774', '#c06747'],
        neonPurple: ['#f4dfbf', '#d1824d'],
    },
    surface: {
        glass: 'rgba(255, 248, 239, 0.78)',
        glassStrong: 'rgba(255, 252, 247, 0.92)',
        overlay: 'rgba(53, 32, 20, 0.58)',
        cardShadow: 'rgba(102, 75, 49, 0.16)',
    },
    hero: {
        primary: '#d79c52',
        secondary: '#bc6d42',
        tertiary: '#8d5037',
        quaternary: '#f2dfc0',
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

        readStoredMode()
            .then((value) => {
                if (!mounted) return;
                if (value) {
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
        persistMode(nextMode);
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
