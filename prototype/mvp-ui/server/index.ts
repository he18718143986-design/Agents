import path from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import httpProxy from "http-proxy";
import {
  agentServerErrorHint,
  handleBuildBootstrap,
  handleCoachBootstrap,
  handleDeployBootstrap,
  handleEngineStatus,
  type GatewayContext,
  type GatewayResult,
} from "./gateway.ts";

/**
 * Production server: serves the built frontend, exposes the engine gateway
 * endpoints, and proxies /api + /sockets (WebSocket) to the agent-server.
 *
 * Env:
 *   PORT              listen port (default 8080)
 *   AGENT_SERVER_URL  agent-server base URL (default http://127.0.0.1:8000)
 *   REPO_ROOT         repo root for workspaces (default: auto-detected)
 *   DEEPSEEK_API_KEY / LLM_API_KEY / LLM_MODEL / LLM_BASE_URL  engine key config
 */

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.REPO_ROOT ?? path.resolve(serverDir, "../../..");
const distDir = path.resolve(serverDir, "../dist");
const agentServer = process.env.AGENT_SERVER_URL ?? "http://127.0.0.1:8000";
const port = Number(process.env.PORT ?? 8080);

if (!existsSync(path.join(distDir, "index.html"))) {
  console.error(
    `dist/index.html not found at ${distDir} — run \`npm run build\` first.`,
  );
  process.exit(1);
}

const ctx: GatewayContext = { repoRoot, agentServer };
const app = express();
const proxy = httpProxy.createProxyServer({
  target: agentServer,
  changeOrigin: true,
  ws: true,
});

proxy.on("error", (error, _req, res) => {
  if (res && "writeHead" in res && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: agentServerErrorHint(error.message) }),
    );
  }
});

// Agent-server proxy MUST run before the JSON body parser so request
// bodies stream through untouched.
app.use((req, res, next) => {
  if (req.url === "/api" || req.url.startsWith("/api/")) {
    proxy.web(req, res);
    return;
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

function send(res: express.Response, result: GatewayResult): void {
  res.status(result.status).type("application/json").send(result.json);
}

function gatewayErrorHandler(res: express.Response, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  res
    .status(502)
    .type("application/json")
    .send(JSON.stringify({ error: agentServerErrorHint(detail) }));
}

app.get("/prototype/api/engine-status", async (_req, res) => {
  try {
    send(res, await handleEngineStatus(ctx));
  } catch {
    res.status(500).json({ agentServer: false, envKey: false, model: null });
  }
});

app.post("/prototype/api/bootstrap-conversation", async (req, res) => {
  try {
    send(res, await handleCoachBootstrap(ctx, req.body ?? {}));
  } catch (error) {
    gatewayErrorHandler(res, error);
  }
});

app.post("/prototype/api/bootstrap-build-conversation", async (req, res) => {
  try {
    send(res, await handleBuildBootstrap(ctx, req.body ?? {}));
  } catch (error) {
    gatewayErrorHandler(res, error);
  }
});

app.post("/prototype/api/bootstrap-deploy-conversation", async (req, res) => {
  try {
    send(res, await handleDeployBootstrap(ctx, req.body ?? {}));
  } catch (error) {
    gatewayErrorHandler(res, error);
  }
});

app.use(express.static(distDir));

// SPA fallback for client-side routes like /app.
app.use((req, res, next) => {
  if (req.method !== "GET") {
    next();
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

const server = createServer(app);

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/sockets/")) {
    proxy.ws(req, socket, head);
    return;
  }
  socket.destroy();
});

server.listen(port, () => {
  console.log(`Stagent production server listening on http://0.0.0.0:${port}`);
  console.log(`  agent-server: ${agentServer}`);
  console.log(`  repo root:    ${repoRoot}`);
  console.log(
    `  env key:      ${process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY ? "configured" : "not set"}`,
  );
});
