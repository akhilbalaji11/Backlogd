/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,jsx,ts,tsx}',
        './src/**/*.{js,jsx,ts,tsx}',
    ],
    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            colors: {
                // Background layers
                bg: {
                    primary: '#0D1117',
                    secondary: '#161B22',
                    tertiary: '#1C2333',
                    card: '#1E2432',
                },
                // Brand colors
                purple: {
                    50: '#F5F3FF',
                    100: '#EDE9FE',
                    200: '#DDD6FE',
                    300: '#C4B5FD',
                    400: '#A78BFA',
                    500: '#8B5CF6',
                    600: '#7C3AED',
                    700: '#6D28D9',
                    800: '#5B21B6',
                    900: '#4C1D95',
                },
                rose: {
                    400: '#FB7185',
                    500: '#F43F5E',
                    600: '#E11D48',
                },
                // Text
                text: {
                    primary: '#F0F6FC',
                    secondary: '#8B949E',
                    muted: '#484F58',
                },
                // Status colors
                status: {
                    played: '#22C55E',    // green
                    playing: '#3B82F6',   // blue
                    backlog: '#F59E0B',   // amber
                    wishlist: '#EC4899',  // pink
                },
                star: '#F59E0B',
                border: '#30363D',
            },
            fontFamily: {
                sans: ['Inter_400Regular'],
                medium: ['Inter_500Medium'],
                semibold: ['Inter_600SemiBold'],
                bold: ['Inter_700Bold'],
            },
            borderRadius: {
                'sm': '8px',
                'md': '12px',
                'lg': '16px',
                'xl': '24px',
            },
        },
    },
    plugins: [],
};
