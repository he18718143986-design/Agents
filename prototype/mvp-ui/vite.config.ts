import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createBootstrapMiddleware } from "./vite.bootstrap.ts";
import { createPbProxy } from "./server/pbProxy.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Local dev: /. GitHub Pages: /Agent/ (set via VITE_BASE_PATH in CI).
const base = process.env.VITE_BASE_PATH ?? "/";

function openhandsBootstrapPlugin(): Plugin {
  return {
    name: "openhands-bootstrap",
    configureServer(server) {
      server.middlewares.use(createBootstrapMiddleware(repoRoot));
      server.middlewares.use(createPbProxy(repoRoot));
    },
  };
}

// pocketbase SDK 的 CollectionService 有名为 `import` 的类方法（async import(...)），
// Vite 的导入分析会把它误判为动态 import() 并注入 injectQuery，产生非法语法。
// 改写为等价的字符串字面量方法名（async "import"(...) ）即可绕过误判。
function patchPocketbaseImportMethod(): Plugin {
  return {
    name: "patch-pocketbase-import-method",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("node_modules/pocketbase/")) return null;
      if (!code.includes("async import(")) return null;
      return { code: code.replaceAll("async import(", 'async "import"('), map: null };
    },
  };
}

export default defineConfig({
  base,
  // 排除预优化，让上面的 transform 插件能处理原始模块
  optimizeDeps: { exclude: ["pocketbase"] },
  plugins: [
    patchPocketbaseImportMethod(),
    react(),
    tailwindcss(),
    openhandsBootstrapPlugin(),
  ],
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
