import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // `localhost` can resolve via IPv6 first on some Windows setups, adding ~200ms per proxied request.
    // Force IPv4 loopback to keep local admin tables/dashboard snappy during development.
    proxy: {
      "/auth": "http://127.0.0.1:3000",
      "/ops": "http://127.0.0.1:3000",
      "/admin": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
    },
  },
});
