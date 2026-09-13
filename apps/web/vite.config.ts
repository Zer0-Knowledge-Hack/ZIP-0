import { defineConfig } from "vite";

const gateway = process.env.GATEWAY_URL || "http://127.0.0.1:3001";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/v1": { target: gateway, changeOrigin: true },
      "/health": { target: gateway, changeOrigin: true },
    },
  },
});
