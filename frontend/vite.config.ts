import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Local development only: the dev server forwards /api to the backend.
// In the container nginx does this, and in Kubernetes the Ingress does.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
});
