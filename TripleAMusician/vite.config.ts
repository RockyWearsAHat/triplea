import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(() => ({
  // Use /musician/ base path on Netlify (unified deployment), / locally
  base: process.env.NETLIFY ? "/musician/" : "/",
  plugins: [react()],
  envDir: path.resolve(__dirname, ".."),
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../packages/shared/src"),
    },
  },
}));
