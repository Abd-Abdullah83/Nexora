/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Light theme (new) ──────────────────────────────────────────────
        ivory: "#F7F5F0",   // main background
        ivoryDark: "#EFECE5",   // slightly darker bg for cards
        ivoryBorder: "#E8E4DC",   // border color
        charcoal: "#1A1A1A",   // primary text
        muted: "#6B6B6B",   // secondary text
        subtle: "#9A9A9A",   // tertiary text
        gold: "#B08D57",   // primary accent
        goldLight: "#C9A96E",   // hover accent
        goldDark: "#8B6D3F",   // darker accent
        parchment: "#FAF9F6",   // lightest bg

        // ── Dark theme (kept for admin) ────────────────────────────────────
        ink: "#0B0E14",
        surface: "#15191F",
        surfaceLight: "#1C2128",
        brass: "#C9A35A",
        brassLight: "#E0C384",
        cream: "#E8E3D9",
        slate: "#A0AFBD",   // secondary text — WCAG AA contrast on dark bg, do not lower
        emerald: "#2E5C4D",
        primary: "#1A3C5E",
        accent: "#C9A35A",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        body: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        sweep: {
          "0%": { transform: "translateX(-120%)" },
          "60%, 100%": { transform: "translateX(220%)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideLeft: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        sweep: "sweep 3.5s ease-in-out infinite",
        rise: "rise 0.6s ease-out",
        glow: "glow 4s ease-in-out infinite",
        fadeIn: "fadeIn 0.2s ease-out",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
        cardHover: "0 4px 16px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.06)",
        header: "0 1px 0 #E8E4DC, 0 2px 8px rgba(0,0,0,0.04)",
        dropdown: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
