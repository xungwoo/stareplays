import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        fg: "hsl(var(--fg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        line: "hsl(var(--line) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)"
      },
      borderRadius: {
        xl: "1rem"
      },
      boxShadow: {
        panel: "0 12px 40px rgba(18, 23, 33, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
