import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import {
  agentServerErrorHint,
  handleAdminOverview,
  handleBuildBootstrap,
  handleCoachBootstrap,
  handleConversationUsage,
  handleDeployBootstrap,
  handleEngineStatus,
  handleRunAppCheck,
  type AppCheckBody,
  type BootstrapBody,
  type BuildBootstrapBody,
  type DeployBootstrapBody,
  type GatewayContext,
  type GatewayResult,
} from "./server/gateway.ts";

const AGENT_SERVER = "http://127.0.0.1:8000";

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeResult(res: ServerResponse, result: GatewayResult): void {
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json");
  res.end(result.json);
}

export function createBootstrapMiddleware(repoRoot: string): Connect.NextHandleFunction {
  const ctx: GatewayContext = { repoRoot, agentServer: AGENT_SERVER };

  return async (req, res, next) => {
    if (req.method === "GET" && req.url === "/prototype/api/admin/overview") {
      try {
        writeResult(
          res,
          await handleAdminOverview(ctx, req.headers["x-admin-token"] as string | undefined),
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        writeResult(res, { status: 500, json: JSON.stringify({ error: detail }) });
      }
      return;
    }

    if (req.method === "GET" && req.url === "/prototype/api/engine-status") {
      try {
        writeResult(res, await handleEngineStatus(ctx));
      } catch {
        writeResult(res, {
          status: 500,
          json: JSON.stringify({ agentServer: false, envKey: false, model: null }),
        });
      }
      return;
    }

    const usageMatch = req.url?.match(
      /^\/prototype\/api\/conversation-usage\/([0-9a-f-]+)$/i,
    );
    if (req.method === "GET" && usageMatch) {
      try {
        writeResult(res, await handleConversationUsage(ctx, usageMatch[1]));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        writeResult(res, {
          status: 502,
          json: JSON.stringify({ error: agentServerErrorHint(detail) }),
        });
      }
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      if (req.url === "/prototype/api/run-app-check") {
        const body = await readJsonBody<AppCheckBody>(req);
        writeResult(
          res,
          await handleRunAppCheck(ctx, body, "http://127.0.0.1:5173"),
        );
        return;
      }
      if (req.url === "/prototype/api/bootstrap-conversation") {
        const body = await readJsonBody<BootstrapBody>(req);
        writeResult(res, await handleCoachBootstrap(ctx, body));
        return;
      }
      if (req.url === "/prototype/api/bootstrap-build-conversation") {
        const body = await readJsonBody<BuildBootstrapBody>(req);
        writeResult(res, await handleBuildBootstrap(ctx, body));
        return;
      }
      if (req.url === "/prototype/api/bootstrap-deploy-conversation") {
        const body = await readJsonBody<DeployBootstrapBody>(req);
        writeResult(res, await handleDeployBootstrap(ctx, body));
        return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      writeResult(res, {
        status: 502,
        json: JSON.stringify({ error: agentServerErrorHint(detail) }),
      });
      return;
    }

    next();
  };
}
