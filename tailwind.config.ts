import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f5c3a", dark: "#0a3f28", light: "#e7f3ec" },
        gold: "#d9a441",
      },
      borderRadius: { xl: "12px" },
    },
  },
  plugins: [],
};
export default config;
