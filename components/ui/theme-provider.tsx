"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import {
  type Theme,
  type ResolvedTheme,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  resolveSystemTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return safe defaults during SSR when context isn't available
    return {
      theme: "light" as Theme,
      resolvedTheme: "light" as ResolvedTheme,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}

// localStorage-backed store: writes notify subscribers; cross-tab via "storage"
const themeListeners = new Set<() => void>();
function subscribeToTheme(onChange: () => void) {
  themeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function notifyThemeChanged() {
  themeListeners.forEach((listener) => listener());
}

const SYSTEM_MEDIA_QUERY = "(prefers-color-scheme: dark)";
function subscribeToSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia(SYSTEM_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

const noopSubscribe = () => () => {};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  // Theme and system preference are external stores: useSyncExternalStore
  // re-reads them after hydration without setState-in-effect cascades.
  const stored = useSyncExternalStore(
    subscribeToTheme,
    () => localStorage.getItem(storageKey),
    () => null
  );
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    () => resolveSystemTheme(),
    () => "light" as ResolvedTheme
  );
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const theme = (stored as Theme | null) ?? defaultTheme;
  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Apply the resolved class and meta color (DOM side effects only)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#0a0a0f" : "#f8fafc"
      );
    }
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      notifyThemeChanged();
    },
    [storageKey]
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Prevent flash of wrong theme by not rendering until mounted
  if (!mounted) {
    return (
      <div style={{ visibility: "hidden" }}>{children}</div>
    );
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
