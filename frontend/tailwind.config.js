/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Geist Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Neo earth tones (2026 palette)
        cream: {
          50:  "#fefdf8",
          100: "#fdf9eb",
          200: "#fbf2d3",
        },
        sage: {
          50:  "#f4f7f3",
          100: "#e6ede2",
          200: "#cbd9c6",
          500: "#7a8a72",
          700: "#4a5944",
        },
        forest: {
          50:  "#f0f9f1",
          100: "#daf0dd",
          200: "#b6e0bb",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#0a2818",
        },
        // Warm accent — rice gold
        rice: {
          50:  "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        // Earth/clay (warm warning)
        clay: {
          50:  "#fdf4f0",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        // Bioluminescent accent (2026 trend)
        glow: {
          300: "#bef264",
          400: "#a3e635",
          500: "#84cc16",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "soft":  "0 1px 3px 0 rgb(20 83 45 / 0.04), 0 1px 2px -1px rgb(20 83 45 / 0.04)",
        "lift":  "0 10px 25px -5px rgb(20 83 45 / 0.08), 0 4px 10px -4px rgb(20 83 45 / 0.05)",
        "glow":  "0 0 0 1px rgb(132 204 22 / 0.2), 0 8px 24px -4px rgb(132 204 22 / 0.15)",
      },
      animation: {
        "fade-in":   "fadeIn 0.5s ease-out",
        "slide-up":  "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft":"pulseSoft 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [],
};
