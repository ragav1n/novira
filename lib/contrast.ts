// Small WCAG contrast helpers for user-chosen colors (e.g. bucket colors) that
// get used as large background fills behind fixed light text. No dependencies.

function parseRgb(hex: string): [number, number, number] | null {
    const m = hex.trim().replace(/^#/, '');
    let r: number, g: number, b: number;
    if (m.length === 3) {
        r = parseInt(m[0] + m[0], 16);
        g = parseInt(m[1] + m[1], 16);
        b = parseInt(m[2] + m[2], 16);
    } else if (m.length === 6 || m.length === 8) {
        r = parseInt(m.slice(0, 2), 16);
        g = parseInt(m.slice(2, 4), 16);
        b = parseInt(m.slice(4, 6), 16);
    } else {
        return null;
    }
    if ([r, g, b].some(v => Number.isNaN(v))) return null;
    return [r, g, b];
}

const toLinear = (c: number): number => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance (0–1) for an #rgb/#rrggbb(aa) color, or null if unparseable. */
export function relativeLuminance(hex: string): number | null {
    const rgb = parseRgb(hex);
    if (!rgb) return null;
    const [r, g, b] = rgb;
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** True when the color is light enough that white text on it risks failing WCAG AA. */
export function isLightColor(hex: string): boolean {
    const L = relativeLuminance(hex);
    return L !== null && L > 0.45;
}

/**
 * Returns a near-black or white text color that meets WCAG contrast against `hex`.
 * Useful when placing text directly on an arbitrary user-chosen background.
 */
export function getReadableForeground(hex: string, dark = '#0A0A0F', light = '#FFFFFF'): string {
    const L = relativeLuminance(hex);
    if (L === null) return light;
    const contrastWhite = 1.05 / (L + 0.05);
    const contrastBlack = (L + 0.05) / 0.05;
    return contrastBlack >= contrastWhite ? dark : light;
}

/** Mixes `hex` toward black by `amount` (0–1), preserving hue. Returns #rrggbb, or null. */
export function darkenHex(hex: string, amount: number): string | null {
    const rgb = parseRgb(hex);
    if (!rgb) return null;
    const k = Math.max(0, Math.min(1, 1 - amount));
    const hx = rgb.map(v => Math.round(v * k).toString(16).padStart(2, '0')).join('');
    return `#${hx}`;
}
