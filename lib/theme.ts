/**
 * AdiV Cyber-Moto Theme System
 *
 * Light mode default with neon cyan primary and motorcycle orange accent.
 * Dark mode for low-light garage environments.
 */

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Maintenance status levels for UI badges */
export type MaintenanceStatus = "upcoming" | "due" | "overdue" | "completed";

/** Theme color tokens — matches CSS custom properties in globals.css */
export const themeColors = {
  light: {
    background: "#f8fafc",
    foreground: "#0f172a",
    card: "#ffffff",
    "card-foreground": "#1e293b",
    primary: "#e62025",
    "primary-foreground": "#000000",
    secondary: "#f1f5f9",
    "secondary-foreground": "#0f172a",
    muted: "#e2e8f0",
    "muted-foreground": "#64748b",
    accent: "#e62025",
    "accent-foreground": "#ffffff",
    destructive: "#ef4444",
    "destructive-foreground": "#000000",
    success: "#22c55e",
    "success-foreground": "#000000",
    warning: "#f59e0b",
    "warning-foreground": "#000000",
    border: "#e2e8f0",
    input: "#e2e8f0",
    ring: "#e62025",
  },
  dark: {
    background: "#0a0a0f",
    foreground: "#e2e8f0",
    card: "#13131f",
    "card-foreground": "#f1f5f9",
    primary: "#e62025",
    "primary-foreground": "#ffffff",
    secondary: "#1e1e2e",
    "secondary-foreground": "#e2e8f0",
    muted: "#27273a",
    "muted-foreground": "#94a3b8",
    accent: "#e62025",
    "accent-foreground": "#ffffff",
    destructive: "#dc2626",
    "destructive-foreground": "#ffffff",
    success: "#22c55e",
    "success-foreground": "#000000",
    warning: "#f59e0b",
    "warning-foreground": "#000000",
    border: "#27273a",
    input: "#27273a",
    ring: "#e62025",
  },
} as const;

/** Status color mapping for maintenance items */
export const statusColors: Record<
  MaintenanceStatus,
  { background: string; foreground: string; border?: string }
> = {
  upcoming: {
    background: "#22c55e",
    foreground: "#ffffff",
  },
  due: {
    background: "#f59e0b",
    foreground: "#000000",
  },
  overdue: {
    background: "#ef4444",
    foreground: "#ffffff",
  },
  completed: {
    background: "#e62025",
    foreground: "#ffffff",
  },
};

/** Tailwind class mapping for status badges */
export const statusBadgeVariants: Record<MaintenanceStatus, string> = {
  upcoming: "bg-success text-success-foreground",
  due: "bg-warning text-warning-foreground",
  overdue: "bg-destructive text-destructive-foreground",
  completed: "bg-primary text-primary-foreground",
};

/**
 * Calculate relative luminance of a hex color (WCAG formula).
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two hex colors (WCAG 2.1).
 * Minimum recommended: 4.5:1 for normal text, 3:1 for large text.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convert hex string to RGB object */
export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  if (isNaN(bigint)) return null;

  if (sanitized.length === 3) {
    const r = ((bigint >> 8) & 0xf) * 17;
    const g = ((bigint >> 4) & 0xf) * 17;
    const b = (bigint & 0xf) * 17;
    return { r, g, b };
  }

  if (sanitized.length === 6) {
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  return null;
}

/** Check if a color pair meets WCAG AA contrast (4.5:1) */
export function meetsWcagAa(hex1: string, hex2: string): boolean {
  return getContrastRatio(hex1, hex2) >= 4.5;
}

/** Check if a color pair meets WCAG AAA contrast (7:1) */
export function meetsWcagAaa(hex1: string, hex2: string): boolean {
  return getContrastRatio(hex1, hex2) >= 7;
}

/** Resolve "system" theme based on user preference */
export function resolveSystemTheme(): ResolvedTheme {
  const m = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  return m?.matches ? "dark" : "light";
}

/** Get the effective theme, resolving "system" if needed */
export function getResolvedTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return resolveSystemTheme();
  return theme;
}

/** Storage key for theme preference */
export const THEME_STORAGE_KEY = "adiv-theme";

/** Default theme for new users */
export const DEFAULT_THEME: Theme = "light";
