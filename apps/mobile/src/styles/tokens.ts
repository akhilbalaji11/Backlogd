// Design tokens — single source of truth for non-Tailwind usage (StyleSheet, animations, etc.)
export const colors = {
    bg: {
        primary: '#0D1117',
        secondary: '#161B22',
        tertiary: '#1C2333',
        card: '#1E2432',
    },
    purple: {
        300: '#C4B5FD',
        400: '#A78BFA',
        500: '#8B5CF6',
        600: '#7C3AED',
        700: '#6D28D9',
    },
    rose: {
        400: '#FB7185',
        500: '#F43F5E',
    },
    text: {
        primary: '#F0F6FC',
        secondary: '#8B949E',
        muted: '#484F58',
    },
    status: {
        played: '#22C55E',
        playing: '#3B82F6',
        backlog: '#F59E0B',
        wishlist: '#EC4899',
    },
    star: '#F59E0B',
    border: '#30363D',
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
} as const;

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
} as const;

export const typography = {
    size: {
        xs: 11,
        sm: 13,
        base: 15,
        md: 17,
        lg: 20,
        xl: 24,
        '2xl': 28,
        '3xl': 34,
    },
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.7,
    },
} as const;

export const STATUS_LABELS = {
    played: 'Played',
    playing: 'Playing',
    backlog: 'Backlog',
    wishlist: 'Wishlist',
} as const;

export const STATUS_ICONS = {
    played: 'checkmark-circle',
    playing: 'game-controller',
    backlog: 'time',
    wishlist: 'heart',
} as const;
