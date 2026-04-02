import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f5f8ff",
          100: "#e6edf9",
          200: "#cddcf0",
          300: "#aabdd8",
          400: "#7e9abf",
          500: "#5f7ea6",
          600: "#4a6588",
          700: "#394f6b",
          800: "#22344e",
          900: "#0d1a2d",
          950: "#07111d"
        }
      },
      boxShadow: {
        glass: "0 20px 80px -32px rgba(13, 26, 45, 0.55)"
      },
      backgroundImage: {
        "deep-blue-grid":
          "radial-gradient(circle at top, rgba(96, 165, 250, 0.22), transparent 28%), linear-gradient(120deg, rgba(7, 17, 29, 1), rgba(13, 26, 45, 0.96) 48%, rgba(34, 52, 78, 0.92))"
      },
      fontFamily: {
        sans: ["var(--font-sans)"]
      }
    }
  },
  plugins: []
};

export default config;
