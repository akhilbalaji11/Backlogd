import jpeg from 'jpeg-js';
import UPNG from 'upng-js';
import { useEffect, useState } from 'react';

// Curated fallback palettes if image decoding fails.
const COLOR_PALETTES = [
    { dominant: '#1a365d', vibrant: '#4299e1' },
    { dominant: '#553c9a', vibrant: '#9f7aea' },
    { dominant: '#744210', vibrant: '#f6ad55' },
    { dominant: '#1a4731', vibrant: '#48bb78' },
    { dominant: '#742a2a', vibrant: '#fc8181' },
    { dominant: '#234e52', vibrant: '#4fd1c5' },
    { dominant: '#322659', vibrant: '#b794f4' },
    { dominant: '#2d3748', vibrant: '#a0aec0' },
    { dominant: '#702459', vibrant: '#ed64a6' },
    { dominant: '#654321', vibrant: '#c4a35a' },
];

const themeCache = new Map<string, DynamicTheme | null>();
const inFlightThemeLoads = new Map<string, Promise<DynamicTheme | null>>();

export interface DynamicTheme {
    dominant: string;
    vibrant: string;
    textPrimary: string;
    textSecondary: string;
    isDark: boolean;
}

type DecodedPixels = {
    width: number;
    height: number;
    data: Uint8Array;
};

type BucketValue = {
    count: number;
    score: number;
    r: number;
    g: number;
    b: number;
};

export function useDynamicTheme(coverUrl?: string): DynamicTheme | null {
    const [theme, setTheme] = useState<DynamicTheme | null>(() => {
        if (!coverUrl) return null;
        return themeCache.get(coverUrl) ?? null;
    });

    useEffect(() => {
        let cancelled = false;

        if (!coverUrl) {
            setTheme(null);
            return () => {
                cancelled = true;
            };
        }

        const cachedTheme = themeCache.get(coverUrl);
        if (cachedTheme !== undefined) {
            setTheme(cachedTheme);
            return () => {
                cancelled = true;
            };
        }

        setTheme(null);

        loadThemeFromImage(coverUrl)
            .then((nextTheme) => {
                if (cancelled) return;
                setTheme(nextTheme);
            })
            .catch(() => {
                if (cancelled) return;
                const fallbackTheme = buildFallbackTheme(coverUrl);
                themeCache.set(coverUrl, fallbackTheme);
                setTheme(fallbackTheme);
            });

        return () => {
            cancelled = true;
        };
    }, [coverUrl]);

    return theme;
}

async function loadThemeFromImage(imageUrl: string): Promise<DynamicTheme | null> {
    const existing = inFlightThemeLoads.get(imageUrl);
    if (existing) return existing;

    const promise = extractDynamicTheme(imageUrl)
        .then((theme) => {
            const resolvedTheme = theme ?? buildFallbackTheme(imageUrl);
            themeCache.set(imageUrl, resolvedTheme);
            return resolvedTheme;
        })
        .finally(() => {
            inFlightThemeLoads.delete(imageUrl);
        });

    inFlightThemeLoads.set(imageUrl, promise);
    return promise;
}

async function extractDynamicTheme(imageUrl: string): Promise<DynamicTheme | null> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const decoded = decodeImage(new Uint8Array(arrayBuffer));
    if (!decoded) return null;

    const dominantColor = pickDominantColor(decoded);
    const vibrantColor = pickVibrantColor(decoded, dominantColor);

    return buildThemeFromColors(dominantColor, vibrantColor);
}

function decodeImage(bytes: Uint8Array): DecodedPixels | null {
    if (isPng(bytes)) {
        const decoded = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const rgba = UPNG.toRGBA8(decoded)[0];
        return {
            width: decoded.width,
            height: decoded.height,
            data: new Uint8Array(rgba),
        };
    }

    if (isJpeg(bytes)) {
        const decoded = jpeg.decode(bytes, {
            useTArray: true,
            formatAsRGBA: true,
        });

        return {
            width: decoded.width,
            height: decoded.height,
            data: decoded.data,
        };
    }

    return null;
}

function pickDominantColor(decoded: DecodedPixels): string {
    const buckets = buildBuckets(decoded, (rgb, hsl) => {
        const luminance = getLuminanceFromRgb(rgb.r, rgb.g, rgb.b);
        return 1 + hsl.s * 0.35 + (0.7 - Math.abs(luminance - 0.45)) * 0.25;
    });

    const best = pickHighestBucket(buckets);
    if (!best) return '#1a365d';

    return rgbToHex(best.r / best.count, best.g / best.count, best.b / best.count);
}

function pickVibrantColor(decoded: DecodedPixels, dominantHex: string): string {
    const buckets = buildBuckets(decoded, (rgb, hsl) => {
        const luminance = getLuminanceFromRgb(rgb.r, rgb.g, rgb.b);
        if (hsl.s < 0.18 || luminance < 0.08 || luminance > 0.92) {
            return 0;
        }

        return 0.2 + hsl.s * 1.4 + (0.8 - Math.abs(hsl.l - 0.52)) * 0.4;
    });

    const best = pickHighestBucket(buckets);
    if (!best) {
        return boostAccentColor(dominantHex);
    }

    return boostAccentColor(rgbToHex(best.r / best.count, best.g / best.count, best.b / best.count));
}

function buildBuckets(
    decoded: DecodedPixels,
    scorePixel: (rgb: { r: number; g: number; b: number }, hsl: { h: number; s: number; l: number }) => number
): Map<string, BucketValue> {
    const buckets = new Map<string, BucketValue>();
    const { data, width, height } = decoded;
    const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 1600)));

    for (let y = 0; y < height; y += stride) {
        for (let x = 0; x < width; x += stride) {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const alpha = data[index + 3];

            if (alpha < 160) continue;

            const hsl = rgbToHsl(r, g, b);
            const score = scorePixel({ r, g, b }, hsl);
            if (score <= 0) continue;

            const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
            const current = buckets.get(key) ?? { count: 0, score: 0, r: 0, g: 0, b: 0 };

            current.count += 1;
            current.score += score;
            current.r += r;
            current.g += g;
            current.b += b;

            buckets.set(key, current);
        }
    }

    return buckets;
}

function pickHighestBucket(buckets: Map<string, BucketValue>): BucketValue | null {
    let best: BucketValue | null = null;

    for (const bucket of buckets.values()) {
        if (!best || bucket.score > best.score) {
            best = bucket;
        }
    }

    return best;
}

function buildThemeFromColors(dominantHex: string, vibrantHex: string): DynamicTheme {
    const dominantHsl = hexToHsl(dominantHex);
    const vibrantHsl = hexToHsl(vibrantHex);
    const surfaceDominant = hslToHex(
        dominantHsl.h,
        clamp(dominantHsl.s * 0.9, 0.18, 0.75),
        clamp(dominantHsl.l * 0.58, 0.12, 0.34)
    );
    const accentVibrant = hslToHex(
        vibrantHsl.h,
        clamp(Math.max(vibrantHsl.s, 0.35), 0.35, 0.92),
        clamp(Math.max(vibrantHsl.l, 0.48), 0.42, 0.68)
    );

    const luminance = getLuminance(surfaceDominant);
    const isDark = luminance < 0.5;

    return {
        dominant: surfaceDominant,
        vibrant: accentVibrant,
        textPrimary: isDark ? '#ffffff' : '#0a0a0f',
        textSecondary: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,15,0.7)',
        isDark,
    };
}

function buildFallbackTheme(coverUrl: string): DynamicTheme {
    const hash = hashString(coverUrl);
    const palette = COLOR_PALETTES[Math.abs(hash) % COLOR_PALETTES.length];
    const luminance = getLuminance(palette.dominant);
    const isDark = luminance < 0.5;

    return {
        dominant: palette.dominant,
        vibrant: palette.vibrant,
        textPrimary: isDark ? '#ffffff' : '#0a0a0f',
        textSecondary: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,15,0.7)',
        isDark,
    };
}

function boostAccentColor(hex: string): string {
    const hsl = hexToHsl(hex);
    return hslToHex(
        hsl.h,
        clamp(Math.max(hsl.s, 0.38), 0.38, 0.95),
        clamp(Math.max(hsl.l, 0.45), 0.4, 0.7)
    );
}

function isJpeg(bytes: Uint8Array): boolean {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
    return bytes.length >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a;
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return rgbToHsl(r, g, b);
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === nr) {
            h = ((ng - nb) / delta) % 6;
        } else if (max === ng) {
            h = (nb - nr) / delta + 2;
        } else {
            h = (nr - ng) / delta + 4;
        }
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return {
        h: ((h * 60) + 360) % 360,
        s,
        l,
    };
}

function hslToHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
        r = c; g = x; b = 0;
    } else if (h < 120) {
        r = x; g = c; b = 0;
    } else if (h < 180) {
        r = 0; g = c; b = x;
    } else if (h < 240) {
        r = 0; g = x; b = c;
    } else if (h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function getLuminanceFromRgb(r: number, g: number, b: number): number {
    const gamma = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * gamma(r) + 0.7152 * gamma(g) + 0.0722 * gamma(b);
}

function getLuminance(hexColor: string): number {
    const cleaned = hexColor.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return getLuminanceFromRgb(r, g, b);
}

export function hexToRgba(hex: string, alpha: number): string {
    const hexClean = hex.replace('#', '');
    const r = parseInt(hexClean.substring(0, 2), 16);
    const g = parseInt(hexClean.substring(2, 4), 16);
    const b = parseInt(hexClean.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
