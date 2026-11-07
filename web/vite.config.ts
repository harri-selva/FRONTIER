import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" = relative asset paths, so the build works on GitHub Pages, Netlify and Vercel alike
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", chunkSizeWarningLimit: 800 },
});
