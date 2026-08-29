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
        // LegalFlow brand — Deep Blue + Gold
        primary: {
          50: "#eef2fb",
          100: "#dae2f5",
          200: "#b7c6ea",
          300: "#8da3d9",
          400: "#5f7fc4",
          500: "#2f55a8",
          600: "#1a365d",
          700: "#162e50",
          800: "#112545",
          900: "#0c1c37",
        },
        gold: {
          50: "#fdf7eb",
          100: "#fbeed2",
          200: "#f5dca4",
          300: "#eec46d",
          400: "#d69e2e",
          500: "#b7791f",
          600: "#975a16",
          700: "#7a4211",
        },
        legal: {
          bg: "#f8f7f4",
          ink: "#1a202c",
          muted: "#5b6270",
        },
        border: {
          DEFAULT: "#e5e7eb",
          primary: "#dbe3f0",
        },
      },
      fontFamily: {
        heading: ["var(--font-merriweather)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(26,54,109,0.08), 0 8px 24px rgba(26,54,109,0.06)",
        gold: "0 4px 14px rgba(214,158,46,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
