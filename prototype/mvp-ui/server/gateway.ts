import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { COACH_SYSTEM_PROMPT } from "../src/engine/canvasPrompt.ts";
import { BUILD_SYSTEM_PROMPT } from "../src/engine/buildPrompt.ts";
import {
  deploySystemPrompt,
  type DeployPhase,
} from "../src/engine/deployPrompt.ts";
import { DEMO_ACCOUNT, ensureInstance } from "./pocketbase.ts";

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

// agent-server >= 1.31 registers built-in tools under snake_case names
// (TerminalTool.name === "terminal") and only registers them when the request
// names the modules whose import side effects perform the registration.
const BUILD_TOOLS = [
  { name: "terminal" },
  { name: "file_editor" },
  { name: "task_tracker" },
];
const BUILD_TOOL_MODULE_QUALNAMES = {
  terminal: "openhands.tools.terminal",
  file_editor: "openhands.tools.file_editor",
  task_tracker: "openhands.tools.task_tracker",
};

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

export interface AppCheckBody {
  conversation_id?: string;
  project_slug?: string;
}

/**
 * 自动体检：对生成应用跑确定性检查并产出截图证据（详见 appCheck.ts）。
 * selfOrigin = 本服务器可自访问的源（需同时具备 /api 与 /pb 代理）。
 */
export async function handleRunAppCheck(
  ctx: GatewayContext,
  body: AppCheckBody,
  selfOrigin: string,
): Promise<GatewayResult> {
  const conversationId = body.conversation_id?.trim();
  const slug = body.project_slug?.trim().toLowerCase();
  if (!conversationId || !/^[0-9a-f-]{8,64}$/i.test(conversationId)) {
    return jsonResult(400, { error: "conversation_id is required" });
  }
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) {
    return jsonResult(400, { error: "project_slug is required" });
  }

  const workspaceDir = path.join(
    ctx.repoRoot, "prototype", "workspaces", "mvp-demo", "builds", slug,
  );
  if (!existsSync(path.join(workspaceDir, "index.html"))) {
    return jsonResult(404, { error: "workspace 中未找到应用（请先完成制作）" });
  }

  let runAppCheck: typeof import("./appCheck.ts").runAppCheck;
  try {
    ({ runAppCheck } = await import("./appCheck.ts"));
  } catch {
    return jsonResult(501, {
      error: "自动体检组件未安装（需 playwright-core 与 Chromium）",
    });
  }

  const basicUser = process.env.BASIC_AUTH_USER?.trim();
  const basicPassword = process.env.BASIC_AUTH_PASSWORD?.trim();

  try {
    const report = await runAppCheck({
      appUrl: `${selfOrigin}/api/conversations/${conversationId}/workspace/index.html`,
      workspaceDir,
      basicAuth:
        basicUser && basicPassword
          ? { user: basicUser, password: basicPassword }
          : undefined,
    });
    return jsonResult(200, report);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return jsonResult(500, { error: `体检执行失败：${detail}` });
  }
}

/**
 * Token usage for a conversation (c_create measurement). Reads the
 * conversation state's stats.usage_to_metrics and aggregates token counts.
 */
export async function handleConversationUsage(
  ctx: GatewayContext,
  conversationId: string,
): Promise<GatewayResult> {
  if (!/^[0-9a-f-]{8,64}$/i.test(conversationId)) {
    return jsonResult(400, { error: "invalid conversation id" });
  }
  const res = await fetch(
    `${ctx.agentServer}/api/conversations/${conversationId}`,
    { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) },
  );
  if (!res.ok) {
    return jsonResult(res.status, { error: await res.text() });
  }
  const data = (await res.json()) as {
    stats?: { usage_to_metrics?: Record<string, unknown> };
  };
  const usageToMetrics = data.stats?.usage_to_metrics ?? {};

  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;
  for (const raw of Object.values(usageToMetrics)) {
    const metrics = raw as {
      accumulated_cost?: number;
      accumulated_token_usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
    cost += metrics.accumulated_cost ?? 0;
    promptTokens += metrics.accumulated_token_usage?.prompt_tokens ?? 0;
    completionTokens += metrics.accumulated_token_usage?.completion_tokens ?? 0;
  }

  return jsonResult(200, {
    conversationId,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    accumulatedCostUsd: cost,
    raw: usageToMetrics,
  });
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

/** Seed the baas-static golden template into a fresh build workspace. */
function seedTemplate(ctx: GatewayContext, workspaceDir: string, slug: string): void {
  const templateDir = path.join(ctx.repoRoot, "prototype", "templates", "baas-static");
  if (!existsSync(path.join(workspaceDir, "app.js"))) {
    cpSync(templateDir, workspaceDir, { recursive: true });
  }
  // (Re)write platform config — never left to the build agent.
  const configTemplate = readFileSync(path.join(templateDir, "config.js"), "utf8");
  writeFileSync(
    path.join(workspaceDir, "config.js"),
    configTemplate
      .replace("__PB_BASE__", `/pb/${slug}`)
      .replace("__DEMO_EMAIL__", DEMO_ACCOUNT.email)
      .replace("__DEMO_PASSWORD__", DEMO_ACCOUNT.password),
  );
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

  const slug = (body.project_slug?.trim() || randomUUID().slice(0, 8)).toLowerCase();
  const workspaceDir = `${ctx.repoRoot}/prototype/workspaces/mvp-demo/builds/${slug}`;
  mkdirSync(workspaceDir, { recursive: true });

  // baas-mvp: real persistence — seed template + start the app's PocketBase.
  try {
    seedTemplate(ctx, workspaceDir, slug);
    await ensureInstance(ctx.repoRoot, slug);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return jsonResult(500, { error: `数据底座启动失败：${detail}` });
  }

  llmResult.llm.usage_id = "mvp-ui-build";

  return forwardConversationCreate(ctx, {
    agent: {
      kind: "Agent",
      llm: llmResult.llm,
      tools: BUILD_TOOLS,
      system_prompt: BUILD_SYSTEM_PROMPT,
    },
    tool_module_qualnames: BUILD_TOOL_MODULE_QUALNAMES,
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
      tools: BUILD_TOOLS,
      system_prompt: deploySystemPrompt(phase),
    },
    tool_module_qualnames: BUILD_TOOL_MODULE_QUALNAMES,
    workspace: { working_dir: workspaceDir },
    max_iterations: 60,
    initial_message: {
      role: "user",
      content: [{ type: "text", text: deploySpec }],
      run: true,
    },
  });
}
