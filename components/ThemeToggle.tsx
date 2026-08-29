"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "@/components/icons";

// Light/dark toggle. The theme is applied to <html data-theme> by a tiny blocking
// script in the root layout BEFORE first paint (default: dark), so this component
// only reflects and updates that state — it never causes a flash. The choice is
// persisted to localStorage and read back by the same pre-paint script next load.
type Theme = "light" | "dark";
const KEY = "aifield.theme";

export function ThemeToggle({ className }: { className?: string }) {
  // null until mounted: the server didn't render a theme, so we read the value the
  // pre-paint script already set on <html> and avoid a hydration mismatch.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }

  const isDark = theme !== "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-sm transition-colors hover:text-accent ${className ?? "text-ink-3"}`}
    >
      {/* Show the destination: a sun in dark mode (→ light), a moon in light mode
          (→ dark). Empty until mounted so the icon never flips on hydration. */}
      {theme === null ? <span className="h-4 w-4" /> : isDark ? <Sun /> : <Moon />}
    </button>
  );
}
