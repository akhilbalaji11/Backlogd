// Design tokens for Backlogd's ember-and-gold cinematic aesthetic.
// Warm metallic surfaces, aged paper lights, and ember accents.

export const colors = {
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

    // Legacy field names retained for compatibility.
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
        hero: ['rgba(19, 13, 9, 0)', 'rgba(19, 13, 9, 0.72)', '#130d09'],
        cardShine: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'],
        neonCyan: ['#f2d29f', '#d18a4d'],
        neonPink: ['#e69b77', '#bb6446'],
        neonPurple: ['#f5dfbf', '#d27d4a'],
    },
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
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    full: 9999,
} as const;

export const typography = {
    size: {
        '2xs': 9,
        xs: 11,
        sm: 13,
        base: 15,
        md: 17,
        lg: 20,
        xl: 24,
        '2xl': 28,
        '3xl': 34,
        '4xl': 42,
    },
    lineHeight: {
        tight: 1.15,
        normal: 1.4,
        relaxed: 1.6,
    },
} as const;

export const animation = {
    duration: {
        fast: 150,
        normal: 250,
        slow: 400,
        verySlow: 600,
    },
    easing: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
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

export const PLATFORM_COLORS: Record<string, string> = {
    PS5: '#d9aa62',
    PS4: '#c88956',
    Xbox: '#a67542',
    Switch: '#ca7051',
    PC: '#93533d',
    iOS: '#b69a7d',
    Android: '#b88a49',
    Other: '#8c7362',
};

export const GENRE_COLORS: Record<string, { bg: string; text: string }> = {
    Action: { bg: 'rgba(201, 113, 76, 0.16)', text: '#cc7952' },
    Adventure: { bg: 'rgba(214, 179, 111, 0.16)', text: '#d2a154' },
    RPG: { bg: 'rgba(165, 95, 67, 0.16)', text: '#ad6648' },
    Strategy: { bg: 'rgba(143, 109, 67, 0.16)', text: '#9b794a' },
    Shooter: { bg: 'rgba(186, 97, 59, 0.16)', text: '#c46e44' },
    Puzzle: { bg: 'rgba(232, 190, 108, 0.16)', text: '#d9a846' },
    Racing: { bg: 'rgba(177, 117, 72, 0.16)', text: '#b57247' },
    Sports: { bg: 'rgba(166, 132, 76, 0.16)', text: '#a57f42' },
    Simulation: { bg: 'rgba(180, 149, 116, 0.16)', text: '#ac8968' },
    Fighting: { bg: 'rgba(158, 80, 58, 0.16)', text: '#a75a43' },
    Horror: { bg: 'rgba(118, 77, 56, 0.16)', text: '#8b573f' },
    Platformer: { bg: 'rgba(208, 139, 92, 0.16)', text: '#c77f57' },
    default: { bg: 'rgba(140, 115, 98, 0.16)', text: '#a1836e' },
};
