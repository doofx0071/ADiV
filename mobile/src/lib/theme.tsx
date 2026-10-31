import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

export const palette = {
  light: {
    background: "#f8fafc",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#1e293b",
    primary: "#e62025",
    primaryForeground: "#ffffff",
    secondary: "#f1f5f9",
    muted: "#e2e8f0",
    mutedForeground: "#64748b",
    border: "#e2e8f0",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#b91c1c",
    tab: "#ffffff",
  },
  dark: {
    background: "#0a0a0f",
    foreground: "#e2e8f0",
    card: "#13131f",
    cardForeground: "#f1f5f9",
    primary: "#e62025",
    primaryForeground: "#ffffff",
    secondary: "#1e1e2e",
    muted: "#27273a",
    mutedForeground: "#94a3b8",
    border: "#27273a",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#dc2626",
    tab: "#11111a",
  },
} as const;

export type AppColors = { [K in keyof typeof palette.light]: string };

interface ThemeValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  colors: AppColors;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "adiv.mobile.theme";
const ThemeContext = createContext<ThemeValue | null>(null);

export function AppThemeProvider({ children }: React.PropsWithChildren) {
  const systemTheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);
  const resolved = mode === "system"
    ? (Platform.OS === "web" && !hydrated ? "light" : systemTheme === "dark" ? "dark" : "light")
    : mode;

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && (value === "system" || value === "light" || value === "dark")) setModeState(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeValue>(() => ({ mode, resolved, colors: palette[resolved], setMode }), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppTheme must be used inside AppThemeProvider");
  return value;
}
