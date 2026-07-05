import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Connect } from "vite";
import { COACH_SYSTEM_PROMPT } from "./src/engine/canvasPrompt.ts";
import { BUILD_SYSTEM_PROMPT } from "./src/engine/buildPrompt.ts";
import {
  deploySystemPrompt,
  type DeployPhase,
} from "./src/engine/deployPrompt.ts";

const AGENT_SERVER = "http://127.0.0.1:8000";
const HEALTH_TIMEOUT_MS = 10_000;
const CREATE_CONVERSATION_TIMEOUT_MS = 45_000;

interface BootstrapBody {
  api_key?: string;
  model?: string;
  base_url?: string;
}

interface BuildBootstrapBody extends BootstrapBody {
  build_spec?: string;
  project_slug?: string;
}

interface DeployBootstrapBody extends BootstrapBody {
  deploy_spec?: string;
  project_slug?: string;
  phase?: DeployPhase;
}

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

function resolveLlm(body: BootstrapBody) {
  const apiKey =
    body.api_key?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return { error: "api_key is required" as const };
  }
  const model =
    body.model?.trim() || process.env.LLM_MODEL || "deepseek/deepseek-chat";
  const baseUrl =
    body.base_url?.trim() ||
    process.env.LLM_BASE_URL ||
    (model.startsWith("deepseek/") ? "https://api.deepseek.com" : undefined);
  const llm: Record<string, string> = {
    model,
    api_key: apiKey,
    usage_id: "mvp-ui-prototype",
  };
  if (baseUrl) {
    llm.base_url = baseUrl;
  }
  return { llm };
}

async function forwardConversationCreate(
  res: ServerResponse,
  payload: Record<string, unknown>,
): Promise<void> {
  const health = await fetch(`${AGENT_SERVER}/health`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  if (!health.ok) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "agent-server 健康检查失败。请确认已在终端运行：uv run agent-server --host 127.0.0.1 --port 8000",
      }),
    );
    return;
  }

  const upstream = await fetch(`${AGENT_SERVER}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(CREATE_CONVERSATION_TIMEOUT_MS),
  });
  const responseBody = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", "application/json");
  res.end(responseBody);
}

function agentServerErrorHint(detail: string): string {
  const timedOut =
    detail.includes("aborted due to timeout") ||
    detail.toLowerCase().includes("timeout");
  if (timedOut) {
    return "连接 agent-server 超时。请确认已在另一个终端运行：cd 仓库根目录 && export OPENHANDS_AGENT_SERVER_CONFIG_PATH=\"$(pwd)/prototype/agent-server.config.json\" && uv run agent-server --host 127.0.0.1 --port 8000；并检查 API Key / Base URL 是否可达。";
  }
  if (detail.includes("fetch failed") || detail.includes("ECONNREFUSED")) {
    return "无法连接 agent-server（127.0.0.1:8000）。请先在另一个终端启动 agent-server。";
  }
  return detail;
}

async function handleCoachBootstrap(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
): Promise<void> {
  let body: BootstrapBody = {};
  try {
    body = await readJsonBody<BootstrapBody>(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const llmResult = resolveLlm(body);
  if ("error" in llmResult) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: llmResult.error }));
    return;
  }

  const workspaceDir = `${repoRoot}/prototype/workspaces/mvp-demo`;
  mkdirSync(workspaceDir, { recursive: true });

  await forwardConversationCreate(res, {
    agent: {
      kind: "Agent",
      llm: llmResult.llm,
      tools: [],
      system_prompt: COACH_SYSTEM_PROMPT,
    },
    workspace: { working_dir: workspaceDir },
    max_iterations: 50,
  });
}

async function handleBuildBootstrap(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
): Promise<void> {
  let body: BuildBootstrapBody = {};
  try {
    body = await readJsonBody<BuildBootstrapBody>(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const llmResult = resolveLlm(body);
  if ("error" in llmResult) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: llmResult.error }));
    return;
  }

  const buildSpec = body.build_spec?.trim();
  if (!buildSpec) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "build_spec is required" }));
    return;
  }

  const slug = body.project_slug?.trim() || randomUUID().slice(0, 8);
  const workspaceDir = `${repoRoot}/prototype/workspaces/mvp-demo/builds/${slug}`;
  mkdirSync(workspaceDir, { recursive: true });

  llmResult.llm.usage_id = "mvp-ui-build";

  await forwardConversationCreate(res, {
    agent: {
      kind: "Agent",
      llm: llmResult.llm,
      tools: [
        { name: "TerminalTool" },
        { name: "FileEditorTool" },
        { name: "TaskTrackerTool" },
      ],
      system_prompt: BUILD_SYSTEM_PROMPT,
    },
    workspace: { working_dir: workspaceDir },
    max_iterations: 80,
    initial_message: {
      role: "user",
      content: [{ type: "text", text: buildSpec }],
      run: true,
    },
  });
}

async function handleDeployBootstrap(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
): Promise<void> {
  let body: DeployBootstrapBody = {};
  try {
    body = await readJsonBody<DeployBootstrapBody>(req);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const llmResult = resolveLlm(body);
  if ("error" in llmResult) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: llmResult.error }));
    return;
  }

  const deploySpec = body.deploy_spec?.trim();
  if (!deploySpec) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "deploy_spec is required" }));
    return;
  }

  const phase: DeployPhase =
    body.phase === "production" ? "production" : "staging";
  const slug = body.project_slug?.trim();
  if (!slug) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "project_slug is required" }));
    return;
  }

  const workspaceDir = `${repoRoot}/prototype/workspaces/mvp-demo/builds/${slug}`;
  mkdirSync(workspaceDir, { recursive: true });

  llmResult.llm.usage_id =
    phase === "staging" ? "mvp-ui-deploy-staging" : "mvp-ui-deploy-production";

  await forwardConversationCreate(res, {
    agent: {
      kind: "Agent",
      llm: llmResult.llm,
      tools: [
        { name: "TerminalTool" },
        { name: "FileEditorTool" },
        { name: "TaskTrackerTool" },
      ],
      system_prompt: deploySystemPrompt(phase),
    },
    workspace: { working_dir: workspaceDir },
    max_iterations: 60,
    initial_message: {
      role: "user",
      content: [{ type: "text", text: deploySpec }],
      run: true,
    },
  });
}

async function handleEngineStatus(res: ServerResponse): Promise<void> {
  let agentServer = false;
  try {
    const health = await fetch(`${AGENT_SERVER}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    agentServer = health.ok;
  } catch {
    agentServer = false;
  }
  const envKey = Boolean(
    process.env.LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim(),
  );
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      agentServer,
      envKey,
      model: process.env.LLM_MODEL?.trim() || null,
    }),
  );
}

export function createBootstrapMiddleware(repoRoot: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method === "GET" && req.url === "/prototype/api/engine-status") {
      try {
        await handleEngineStatus(res);
      } catch {
        res.statusCode = 500;
        res.end(JSON.stringify({ agentServer: false, envKey: false, model: null }));
      }
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    try {
      if (req.url === "/prototype/api/bootstrap-conversation") {
        await handleCoachBootstrap(req, res, repoRoot);
        return;
      }
      if (req.url === "/prototype/api/bootstrap-build-conversation") {
        await handleBuildBootstrap(req, res, repoRoot);
        return;
      }
      if (req.url === "/prototype/api/bootstrap-deploy-conversation") {
        await handleDeployBootstrap(req, res, repoRoot);
        return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: agentServerErrorHint(detail) }));
      return;
    }

    next();
  };
}
