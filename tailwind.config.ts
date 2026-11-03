import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B1B33", soft: "#334155", muted: "#64748B" },
        brand: { DEFAULT: "#0E7C66", dark: "#095C4C", light: "#E6F4F0", 50: "#F3FAF8" },
        spark: { DEFAULT: "#F5A524", light: "#FEF3DC" },
        danger: { DEFAULT: "#B42318", light: "#FEECEB" },
        canvas: "#F7F8F6",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      borderRadius: { xl: "14px", "2xl": "20px" },
      boxShadow: { card: "0 1px 2px rgba(11,27,51,.04), 0 4px 16px rgba(11,27,51,.05)" },
    },
  },
  plugins: [],
};
export default config;
