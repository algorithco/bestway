"use client";

import * as React from "react";

type Attribute = `data-${string}` | "class";

interface ValueObject {
  [themeName: string]: string;
}

interface ThemeProviderProps extends React.PropsWithChildren {
  themes?: string[] | undefined;
  forcedTheme?: string | undefined;
  enableSystem?: boolean | undefined;
  disableTransitionOnChange?: boolean | undefined;
  enableColorScheme?: boolean | undefined;
  storageKey?: string | undefined;
  defaultTheme?: string | undefined;
  attribute?: Attribute | Attribute[] | undefined;
  value?: ValueObject | undefined;
  nonce?: string;
  scriptProps?: React.ScriptHTMLAttributes<HTMLScriptElement>;
}

interface UseThemeProps {
  themes: string[];
  forcedTheme?: string | undefined;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  theme?: string | undefined;
  resolvedTheme?: string | undefined;
  systemTheme?: "dark" | "light" | undefined;
}

const ThemeContext = React.createContext<UseThemeProps | undefined>(undefined);

export function useTheme(): UseThemeProps {
  const ctx = React.useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    themes: [],
    setTheme: () => {},
    theme: undefined,
    resolvedTheme: undefined,
    systemTheme: undefined,
    forcedTheme: undefined,
  };
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function disableAnimation(nonce?: string) {
  const css = document.createElement("style");
  if (nonce) css.setAttribute("nonce", nonce);
  css.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
    )
  );
  document.head.appendChild(css);
  return () => {
    // Force reflow
    window.getComputedStyle(document.body);
    setTimeout(() => {
      if (css.parentNode) document.head.removeChild(css);
    }, 1);
  };
}

export function ThemeProvider({
  forcedTheme,
  disableTransitionOnChange = false,
  enableSystem = true,
  enableColorScheme = true,
  storageKey = "theme",
  themes = ["light", "dark"],
  defaultTheme = enableSystem ? "system" : "light",
  attribute = "data-theme",
  value,
  children,
  nonce,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string>(() => {
    // SSR - return defaultTheme, client will correct from localStorage after mount if needed
    if (typeof window === "undefined") return defaultTheme;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [systemTheme, setSystemTheme] = React.useState<"dark" | "light" | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return enableSystem ? getSystemTheme() : undefined;
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<string | undefined>(() => {
    if (forcedTheme) return forcedTheme;
    if (theme === "system" && enableSystem) {
      if (typeof window === "undefined") return undefined;
      return getSystemTheme();
    }
    return theme;
  });

  // Keep resolvedTheme in sync
  React.useEffect(() => {
    if (forcedTheme) {
      setResolvedTheme(forcedTheme);
      return;
    }
    if (theme === "system" && enableSystem) {
      setResolvedTheme(systemTheme);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme, systemTheme, forcedTheme, enableSystem]);

  const applyTheme = React.useCallback(
    (targetTheme: string | undefined) => {
      if (!targetTheme) return;
      let resolved = targetTheme;
      if (targetTheme === "system" && enableSystem) {
        resolved = getSystemTheme();
      }
      const mapped = value ? value[resolved] ?? resolved : resolved;
      const allValues = value ? Object.values(value) : themes;

      const cleanup = disableTransitionOnChange ? disableAnimation(nonce) : null;

      const el = document.documentElement;

      const handleAttribute = (attr: Attribute) => {
        if (attr === "class") {
          // Remove all theme classes
          el.classList.remove(...allValues);
          // Also remove "system" if it was added (when value mapping not covering it)
          // Ensure we also handle light/dark directly when value mapping missing
          if (value) {
            // value mapping already handled via allValues
          } else {
            // themes already includes light/dark, but not system
            el.classList.remove("system");
          }
          if (mapped) el.classList.add(mapped);
        } else if (attr.startsWith("data-")) {
          if (mapped) el.setAttribute(attr, mapped);
          else el.removeAttribute(attr);
        }
      };

      if (Array.isArray(attribute)) {
        attribute.forEach(handleAttribute);
      } else {
        handleAttribute(attribute as Attribute);
      }

      if (enableColorScheme) {
        const colorSchemes: string[] = ["light", "dark"];
        const isLightOrDark = colorSchemes.includes(resolved);
        const fallback = colorSchemes.includes(defaultTheme) ? defaultTheme : null;
        const scheme = isLightOrDark ? resolved : fallback;
        if (scheme) {
          el.style.colorScheme = scheme;
        } else {
          el.style.colorScheme = "";
        }
      }

      if (cleanup) cleanup();
    },
    [attribute, value, themes, enableSystem, enableColorScheme, disableTransitionOnChange, nonce, defaultTheme]
  );

  // Apply theme when theme/resolvedTheme/forcedTheme changes
  React.useEffect(() => {
    const toApply = forcedTheme ?? theme;
    applyTheme(toApply);
  }, [theme, forcedTheme, applyTheme]);

  // Listen to system theme changes
  React.useEffect(() => {
    if (!enableSystem) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const newSystem = e.matches ? "dark" : "light";
      setSystemTheme(newSystem);
      // If current theme is system, apply new system theme
      if (theme === "system" && !forcedTheme) {
        applyTheme("system");
      }
    };
    // Initial
    setSystemTheme(media.matches ? "dark" : "light");
    // Modern browsers use addEventListener
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    } else {
      // Safari <14
      // @ts-ignore
      media.addListener(handleChange);
      // @ts-ignore
      return () => media.removeListener(handleChange);
    }
  }, [enableSystem, theme, forcedTheme, applyTheme]);

  // Listen to storage events (sync across tabs)
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        if (e.newValue) setThemeState(e.newValue);
        else setThemeState(defaultTheme);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey, defaultTheme]);

  const setTheme = React.useCallback(
    (newTheme: string | ((prev: string) => string)) => {
      const resolvedNew = typeof newTheme === "function" ? (newTheme as (prev: string) => string)(theme) : newTheme;
      setThemeState(resolvedNew);
      try {
        localStorage.setItem(storageKey, resolvedNew);
      } catch {}
      // Apply immediately for snappy UI
      if (!forcedTheme) {
        applyTheme(resolvedNew);
      }
    },
    [theme, storageKey, forcedTheme, applyTheme]
  );

  const providerValue = React.useMemo<UseThemeProps>(
    () => ({
      theme: forcedTheme ?? theme,
      setTheme,
      forcedTheme,
      resolvedTheme: forcedTheme ?? resolvedTheme,
      systemTheme: enableSystem ? systemTheme : undefined,
      themes: enableSystem ? [...themes, "system"] : themes,
    }),
    [theme, setTheme, forcedTheme, resolvedTheme, systemTheme, enableSystem, themes]
  );

  // IMPORTANT: No <script> tag here - React 19 forbids <script> inside client components.
  // FOUC prevention script is injected as a server component in layout.tsx
  return <ThemeContext.Provider value={providerValue}>{children}</ThemeContext.Provider>;
}
