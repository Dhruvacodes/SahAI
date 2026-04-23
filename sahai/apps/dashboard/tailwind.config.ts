import type { Config } from "tailwindcss";

/**
 * Tailwind CSS content and theme configuration for the dashboard app.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;

