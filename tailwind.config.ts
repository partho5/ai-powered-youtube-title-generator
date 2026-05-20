import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        yt: {
          red: "#ff0000",
          redHover: "#cc0000",
          bg: "#ffffff",
          surface: "#f9f9f9",
          border: "#e5e5e5",
          text: "#0f0f0f",
          muted: "#606060",
          chip: "#f2f2f2",
        },
      },
      fontFamily: {
        sans: [
          "Roboto",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
