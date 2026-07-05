import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createBootstrapMiddleware } from "./vite.bootstrap.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Local dev: /. GitHub Pages: /Agent/ (set via VITE_BASE_PATH in CI).
const base = process.env.VITE_BASE_PATH ?? "/";

function openhandsBootstrapPlugin(): Plugin {
  return {
    name: "openhands-bootstrap",
    configureServer(server) {
      server.middlewares.use(createBootstrapMiddleware(repoRoot));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), openhandsBootstrapPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/sockets": { target: "ws://127.0.0.1:8000", ws: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
});
