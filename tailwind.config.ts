import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        raised: "var(--raised)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "on-accent": "var(--on-accent)",
        good: "var(--good)",
        warn: "var(--warn)",
        hairline: "var(--hairline)",
        "marker-open": "var(--marker-open)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "2px",
        sm: "2px",
      },
      maxWidth: {
        reading: "1000px",
        measure: "68ch",
      },
      boxShadow: {
        layer: "0 8px 28px -12px rgba(0,0,0,.28)",
      },
      keyframes: {
        riseIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        wash: {
          from: { backgroundColor: "var(--sel-bg)" },
          to: { backgroundColor: "transparent" },
        },
      },
      animation: {
        riseIn: "riseIn .68s cubic-bezier(.16,1,.3,1) both",
        fadeUp: "fadeUp .5s cubic-bezier(.16,1,.3,1) both",
        breathe: "breathe 2.1s ease-in-out infinite",
        wash: "wash 1.1s ease-out",
      },
      transitionTimingFunction: {
        ease: "cubic-bezier(.16,1,.3,1)",
      },
    },
  },
  plugins: [],
};

export default config;
