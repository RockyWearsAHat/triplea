import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(() => ({
  // Use /muse/ base path on Netlify (unified deployment), / locally
  base: process.env.NETLIFY ? "/muse/" : "/",
  plugins: [react()],
  envDir: path.resolve(__dirname, ".."),
  server: {
    port: 5175,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../packages/shared/src"),
    },
  },
}));
