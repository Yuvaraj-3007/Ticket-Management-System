import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tms/core": path.resolve(__dirname, "../packages/core/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // PROXY_TARGET (no VITE_ prefix) is used by Playwright so Bun's .env
        // loader doesn't override it with the dev value from client/.env
        target: process.env.PROXY_TARGET || process.env.VITE_PROXY_TARGET || "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: process.env.PROXY_TARGET || process.env.VITE_PROXY_TARGET || "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/setupTests.ts"],
    globals: true,
  },
});
