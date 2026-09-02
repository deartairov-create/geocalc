import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        cyber: {
          emerald: "#10B981",
          emeraldDark: "#059669",
          cobalt: "#2563EB",
          cobaltDark: "#1D4ED8",
          teal: "#14B8A6",
          cyan: "#06B6D4",
        },
      },
      fontFamily: {
        sans: [
          "Geist Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "SF Mono",
          "Fira Code",
          "monospace",
        ],
      },
      animation: {
        "aurora-1": "floatAurora1 18s ease-in-out infinite alternate",
        "aurora-2": "floatAurora2 22s ease-in-out infinite alternate",
        "aurora-3": "floatAurora3 26s ease-in-out infinite alternate",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
      keyframes: {
        floatAurora1: {
          "0%": { transform: "translate(0, 0) scale(1)", opacity: "0.22" },
          "50%": { transform: "translate(60px, 40px) scale(1.15)", opacity: "0.35" },
          "100%": { transform: "translate(-30px, 70px) scale(0.95)", opacity: "0.22" },
        },
        floatAurora2: {
          "0%": { transform: "translate(0, 0) scale(1.1)", opacity: "0.18" },
          "50%": { transform: "translate(-50px, 60px) scale(0.9)", opacity: "0.28" },
          "100%": { transform: "translate(40px, -30px) scale(1.15)", opacity: "0.18" },
        },
        floatAurora3: {
          "0%": { transform: "translate(0, 0) scale(0.95)", opacity: "0.15" },
          "50%": { transform: "translate(70px, -50px) scale(1.2)", opacity: "0.30" },
          "100%": { transform: "translate(-60px, 20px) scale(1)", opacity: "0.15" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" },
        },
      },
      boxShadow: {
        "liquid-card": "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.45), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.25), 0 20px 50px -10px rgba(0, 8, 24, 0.65)",
        "liquid-pill": "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.65), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.2), 0 10px 30px rgba(0, 0, 0, 0.35)",
        "liquid-primary": "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.85), 0 12px 30px rgba(16, 185, 129, 0.38)",
        "liquid-cobalt": "inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.85), 0 12px 30px rgba(37, 99, 235, 0.38)",
      },
    },
  },
  plugins: [],
};

export default config;
