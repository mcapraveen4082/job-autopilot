import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: "#172033",
        slate: { 50: "#F3F5F8", 100: "#E7EBF0", 200: "#D3D9E2", 400: "#8A94A6", 600: "#4E596C" },
        signal: { DEFAULT: "#1F5FA8", dark: "#174A84", soft: "#E3EDF8" },
        wait: { DEFAULT: "#B7791F", soft: "#FBF0DC" },
        done: { DEFAULT: "#2E7D4F", soft: "#E1F2E7" },
        stop: { DEFAULT: "#B4413A", soft: "#F8E3E1" },
      },
    },
  },
  plugins: [],
} satisfies Config;
