import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): Theme {
  try {
    return (localStorage.getItem("kf-theme") as Theme) || "dark";
  } catch {
    return "dark";
  }
}

/**
 * Dark is the design's default and what every prerendered page declares.
 *
 * The stored preference is read *after* the first render, not in the state
 * initialiser: the sun/moon icon sits in the header outside every Suspense
 * boundary, and a first render that differs from the HTML makes React 19
 * discard the whole page and render it again. The prerendered HTML's inline
 * boot script already set `data-kf-theme="light"` before paint for a light
 * visitor, so the layout effect only has to bring the state in line — before
 * the browser paints this commit.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const first = useRef(true);

  useLayoutEffect(() => {
    const attr = document.documentElement.getAttribute("data-kf-theme");
    const stored = attr === "light" || attr === "dark" ? (attr as Theme) : readStored();
    if (stored !== "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    // The first run would write "dark" over the attribute the boot script
    // set, for one frame, before the layout effect's update lands.
    if (first.current) {
      first.current = false;
      if (theme === "dark") return;
    }
    document.documentElement.setAttribute("data-kf-theme", theme);
    try {
      localStorage.setItem("kf-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
