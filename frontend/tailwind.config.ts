import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#5551FF",
        "primary-foreground": "#FFFFFF",
        secondary: "#7C3AED",
        "secondary-foreground": "#FFFFFF",
        background: {
          light: "#E0F2F7",
          dark: "#0F172A",
        },
        surface: {
          light: "rgba(255, 255, 255, 0.7)",
          dark: "rgba(15, 23, 42, 0.7)",
        },
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        muted: {
          DEFAULT: "#64748B",
          foreground: "#94A3B8",
        },
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        sans: ["Plus Jakarta Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      backdropBlur: {
        glass: "20px",
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
