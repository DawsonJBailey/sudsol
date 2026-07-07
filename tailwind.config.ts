import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: "#1F3A2E",
        "pine-dark": "#152A20",
        gold: "#C9922E",
        "gold-light": "#E0B563",
        parchment: "#EDE7D9",
        "parchment-dark": "#E0D9C6",
        charcoal: "#26261F",
        clay: "#9C4A3C",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["'Work Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
