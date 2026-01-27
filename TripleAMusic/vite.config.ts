import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(() => ({
  // Use /music/ base path on Netlify (unified deployment), / locally
  base: process.env.NETLIFY ? "/music/" : "/",
  plugins: [react()],
  envDir: path.resolve(__dirname, ".."),
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../packages/shared/src"),
      // Dedupe React to prevent multiple instances
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-router-dom": path.resolve(
        __dirname,
        "node_modules/react-router-dom",
      ),
    },
  },
}));
