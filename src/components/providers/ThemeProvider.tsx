"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ dark: false, toggle: () => {} });

/**
 * Applies `data-theme` to <html>. The initial value is set by a blocking
 * inline script in the root layout so there is no flash of the wrong theme;
 * this provider only keeps React in sync afterwards.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      writeStorage(STORAGE_KEYS.dark, next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Runs before paint to avoid a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.dark,
)});var d=v?JSON.parse(v):false;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export { readStorage };
