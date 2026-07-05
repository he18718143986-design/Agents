import type { IncomingMessage, ServerResponse } from "node:http";
import httpProxy from "http-proxy";
import { ensureInstance, parsePbPath } from "./pocketbase.ts";

/**
 * Connect-style middleware: proxy "/pb/<slug>/..." to that app's PocketBase
 * instance (starting it on demand). Shared by the Vite dev server and the
 * production server.
 */
export function createPbProxy(repoRoot: string) {
  const proxy = httpProxy.createProxyServer({ changeOrigin: true });

  proxy.on("error", (error, _req, res) => {
    if (res && "writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `PocketBase 代理失败: ${error.message}` }));
    }
  });

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => {
    const parsed = parsePbPath(req.url ?? "");
    if (!parsed) {
      next();
      return;
    }

    try {
      const instance = await ensureInstance(repoRoot, parsed.slug);
      req.url = parsed.rest;
      proxy.web(req, res, { target: `http://127.0.0.1:${instance.port}` });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `PocketBase 实例不可用: ${detail}` }));
    }
  };
}
