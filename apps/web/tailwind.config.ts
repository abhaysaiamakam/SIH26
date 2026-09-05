import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rail: {
          bg: "#0b1220",
          panel: "#101a2c",
          border: "#1f2c44",
          accent: "#2f81f7",
          warn: "#d97706",
          critical: "#dc2626",
          ok: "#16a34a",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
