/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        base: "#0a0a1a",
        surface: "#12121f",
        card: "#1a1a2e",
        border: "rgba(255,255,255,0.08)",
        primary: "#6366f1",
        "primary-dark": "#4f46e5",
        accent: "#a855f7",
        success: "#22c55e",
        danger: "#f43f5e",
        warning: "#f59e0b",
        muted: "#94a3b8",
        subtle: "#475569",
      },
    },
  },
  plugins: [],
}
