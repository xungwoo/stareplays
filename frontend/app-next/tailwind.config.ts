import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        panelAlt: "rgb(var(--color-panel-alt) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        cyan: "rgb(var(--color-cyan) / <alpha-value>)",
        blue: "rgb(var(--color-blue) / <alpha-value>)",
        emerald: "rgb(var(--color-emerald) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        red: "rgb(var(--color-red) / <alpha-value>)",
        violet: "rgb(var(--color-violet) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)"
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        panel: "0 18px 60px rgba(4, 10, 28, 0.45)"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
