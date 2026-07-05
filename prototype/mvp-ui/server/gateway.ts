import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { COACH_SYSTEM_PROMPT } from "../src/engine/canvasPrompt.ts";
import { BUILD_SYSTEM_PROMPT } from "../src/engine/buildPrompt.ts";
import {
  deploySystemPrompt,
  type DeployPhase,
} from "../src/engine/deployPrompt.ts";

/**
 * Framework-agnostic engine gateway shared by the Vite dev middleware
 * (vite.bootstrap.ts) and the production server (server/index.ts).
 */

export interface GatewayContext {
  repoRoot: string;
  agentServer: string;
}

export interface GatewayResult {
  status: number;
  /** JSON string ready to be written to the response. */
  json: string;
}

export interface BootstrapBody {
  api_key?: string;
  model?: string;
  base_url?: string;
}

export interface BuildBootstrapBody extends BootstrapBody {
  build_spec?: string;
  project_slug?: string;
}

export interface DeployBootstrapBody extends BootstrapBody {
  deploy_spec?: string;
  project_slug?: string;
  phase?: DeployPhase;
}

const HEALTH_TIMEOUT_MS = 10_000;
const CREATE_CONVERSATION_TIMEOUT_MS = 45_000;

function jsonResult(status: number, body: unknown): GatewayResult {
  return { status, json: JSON.stringify(body) };
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

export function agentServerErrorHint(detail: string): string {
  const timedOut =
    detail.includes("aborted due to timeout") ||
    detail.toLowerCase().includes("timeout");
  if (timedOut) {
    return "连接 agent-server 超时。请确认 agent-server 已运行（默认 127.0.0.1:8000），并检查 API Key / Base URL 是否可达。";
  }
  if (detail.includes("fetch failed") || detail.includes("ECONNREFUSED")) {
    return "无法连接 agent-server。请先启动 agent-server（uv run agent-server --host 127.0.0.1 --port 8000）。";
  }
  return detail;
}

async function forwardConversationCreate(
  ctx: GatewayContext,
  payload: Record<string, unknown>,
): Promise<GatewayResult> {
  const health = await fetch(`${ctx.agentServer}/health`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  if (!health.ok) {
    return jsonResult(502, {
      error:
        "agent-server 健康检查失败。请确认已运行：uv run agent-server --host 127.0.0.1 --port 8000",
    });
  }

  const upstream = await fetch(`${ctx.agentServer}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(CREATE_CONVERSATION_TIMEOUT_MS),
  });
  const responseBody = await upstream.text();
  return { status: upstream.status, json: responseBody };
}

export async function handleEngineStatus(
  ctx: GatewayContext,
): Promise<GatewayResult> {
  let agentServer = false;
  try {
    const health = await fetch(`${ctx.agentServer}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    agentServer = health.ok;
  } catch {
    agentServer = false;
  }
  const envKey = Boolean(
    process.env.LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim(),
  );
  return jsonResult(200, {
    agentServer,
    envKey,
    model: process.env.LLM_MODEL?.trim() || null,
  });
}

export async function handleCoachBootstrap(
  ctx: GatewayContext,
  body: BootstrapBody,
): Promise<GatewayResult> {
  const llmResult = resolveLlm(body);
  if ("error" in llmResult) {
    return jsonResult(400, { error: llmResult.error });
  }

  const workspaceDir = `${ctx.repoRoot}/prototype/workspaces/mvp-demo`;
  mkdirSync(workspaceDir, { recursive: true });

  return forwardConversationCreate(ctx, {
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

export async function handleBuildBootstrap(
  ctx: GatewayContext,
  body: BuildBootstrapBody,
): Promise<GatewayResult> {
  const llmResult = resolveLlm(body);
  if ("error" in llmResult) {
    return jsonResult(400, { error: llmResult.error });
  }

  const buildSpec = body.build_spec?.trim();
  if (!buildSpec) {
    return jsonResult(400, { error: "build_spec is required" });
  }

  const slug = body.project_slug?.trim() || randomUUID().slice(0, 8);
  const workspaceDir = `${ctx.repoRoot}/prototype/workspaces/mvp-demo/builds/${slug}`;
  mkdirSync(workspaceDir, { recursive: true });

  llmResult.llm.usage_id = "mvp-ui-build";

  return forwardConversationCreate(ctx, {
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

export async function handleDeployBootstrap(
  ctx: GatewayContext,
  body: DeployBootstrapBody,
): Promise<GatewayResult> {
  const llmResult = resolveLlm(body);
  if ("error" in llmResult) {
    return jsonResult(400, { error: llmResult.error });
  }

  const deploySpec = body.deploy_spec?.trim();
  if (!deploySpec) {
    return jsonResult(400, { error: "deploy_spec is required" });
  }

  const phase: DeployPhase =
    body.phase === "production" ? "production" : "staging";
  const slug = body.project_slug?.trim();
  if (!slug) {
    return jsonResult(400, { error: "project_slug is required" });
  }

  const workspaceDir = `${ctx.repoRoot}/prototype/workspaces/mvp-demo/builds/${slug}`;
  mkdirSync(workspaceDir, { recursive: true });

  llmResult.llm.usage_id =
    phase === "staging" ? "mvp-ui-deploy-staging" : "mvp-ui-deploy-production";

  return forwardConversationCreate(ctx, {
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
