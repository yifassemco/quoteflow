import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15201c",
        moss: "#1f6f5b",
        kelp: "#0d3f37",
        limewash: "#eff7df",
        marigold: "#f2bf4d",
        coral: "#e86d4f",
        skyglass: "#dceef7",
        paper: "#fbfaf4",
      },
      boxShadow: {
        color: "0 24px 70px rgba(31, 111, 91, 0.18)",
        lift: "0 14px 40px rgba(21, 32, 28, 0.12)",
      },
      fontFamily: {
        sans: ["Geist", "Satoshi", "Aptos", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Cabinet Grotesk", "Geist", "Aptos", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "SFMono-Regular", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
