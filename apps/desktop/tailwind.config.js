/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dj: {
          bg: "#0f1117",
          surface: "#181b24",
          card: "#1e2230",
          border: "#2a2f42",
          accent: "#3b82f6",
          neon: "#06b6d4",
          text: "#f1f5f9",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
