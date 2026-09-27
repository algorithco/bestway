"use client";

import * as React from "react";

// Dark-only theme provider — white/light theme deleted entirely.
// Keeps the old `useTheme` / `ThemeProvider` API so existing imports keep working,
// but the app is always dark: `<html>` always has `.dark`, `color-scheme: dark`.

interface UseThemeProps {
  themes: string[];
  forcedTheme?: string | undefined;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  theme?: string | undefined;
  resolvedTheme?: string | undefined;
  systemTheme?: undefined;
}

const ThemeContext = React.createContext<UseThemeProps | undefined>(undefined);

export function useTheme(): UseThemeProps {
  const ctx = React.useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    themes: ["dark"],
    setTheme: () => {},
    theme: "dark",
    resolvedTheme: "dark",
    systemTheme: undefined,
    forcedTheme: "dark",
  };
}

interface ThemeProviderProps extends React.PropsWithChildren {
  forcedTheme?: string | undefined;
  defaultTheme?: string | undefined;
  enableSystem?: boolean | undefined;
  attribute?: unknown;
  storageKey?: string | undefined;
  themes?: string[] | undefined;
  disableTransitionOnChange?: boolean | undefined;
  enableColorScheme?: boolean | undefined;
  value?: unknown;
  nonce?: string;
}

export function ThemeProvider({ children, storageKey = "theme" }: ThemeProviderProps) {
  // Enforce dark on mount + clean up any stale light/system preference.
  React.useEffect(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.setItem(storageKey, "dark");
    } catch {}
    const el = document.documentElement;
    el.classList.add("dark");
    el.style.colorScheme = "dark";
  }, [storageKey]);

  const setTheme = React.useCallback(() => {
    // No-op — dark only. Keep `.dark` enforced in case something removes it.
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
  }, []) as React.Dispatch<React.SetStateAction<string>>;

  const providerValue = React.useMemo<UseThemeProps>(
    () => ({
      theme: "dark",
      setTheme,
      forcedTheme: "dark",
      resolvedTheme: "dark",
      systemTheme: undefined,
      themes: ["dark"],
    }),
    [setTheme],
  );

  return <ThemeContext.Provider value={providerValue}>{children}</ThemeContext.Provider>;
}
