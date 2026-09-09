/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["\"IBM Plex Sans\"", "Segoe UI", "sans-serif"],
        display: ["\"IBM Plex Sans\"", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f4f6f5",
          100: "#e4e9e6",
          200: "#c5d0ca",
          700: "#2f3d38",
          900: "#121a17",
        },
        accent: {
          DEFAULT: "#c45c26",
          muted: "#e8a07a",
        },
      },
    },
  },
  plugins: [],
};
