import type { Config } from "tailwindcss";
import { nexusTokens } from "@nexus/ui/tailwind";

const config: Config = {
  presets: [nexusTokens],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.css",
  ],
  plugins: [],
};

export default config;