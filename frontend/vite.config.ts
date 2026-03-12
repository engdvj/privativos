import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = (env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1").trim();

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      // Pode apontar para backend local em :3000 ou Docker em :80 via VITE_API_PROXY_TARGET.
      // Ex.: VITE_API_PROXY_TARGET=http://127.0.0.1:3000
      proxy: {
        "/auth": apiProxyTarget,
        "/ops": apiProxyTarget,
        "/admin": apiProxyTarget,
        "/health": apiProxyTarget,
      },
    },
  };
});
