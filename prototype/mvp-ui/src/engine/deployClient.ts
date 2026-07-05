import type { EngineBootstrapConfig } from "./apiConfig";
import type { DeployPhase } from "./deployPrompt.js";
import type { EngineEvent } from "./openhandsClient";
import {
  extractAgentMessageText,
  extractExecutionStatus,
} from "./openhandsClient";

const API_BASE = import.meta.env.VITE_AGENT_SERVER_URL ?? "";

function wsBaseUrl(): string {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, "ws");
}

export function workspaceDeployPreviewUrl(
  conversationId: string,
  phase: DeployPhase,
): string {
  const segment = phase === "staging" ? "staging" : "production";
  return `/api/conversations/${conversationId}/workspace/${segment}/index.html`;
}

export async function probeDeployPreview(
  conversationId: string,
  phase: DeployPhase,
): Promise<string | null> {
  const url = workspaceDeployPreviewUrl(conversationId, phase);
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, { method });
      if (res.ok) return url;
    } catch {
      // try next
    }
  }
  if (phase === "staging") {
    const root = `/api/conversations/${conversationId}/workspace/index.html`;
    try {
      const res = await fetch(root, { method: "HEAD" });
      if (res.ok) return root;
    } catch {
      // no fallback
    }
  }
  return null;
}

export function isDeployReadySignal(
  event: EngineEvent,
  phase: DeployPhase,
): boolean {
  const text = extractAgentMessageText(event);
  if (!text) return false;
  return phase === "staging"
    ? text.includes("[STAGING_READY]")
    : text.includes("[DEPLOY_DONE]");
}

export function isActionEvent(event: EngineEvent): boolean {
  return (event.kind ?? "").includes("ActionEvent");
}

export class DeployClient {
  readonly conversationId: string;
  readonly phase: DeployPhase;
  private ws: WebSocket;

  constructor(conversationId: string, phase: DeployPhase, ws: WebSocket) {
    this.conversationId = conversationId;
    this.phase = phase;
    this.ws = ws;
  }

  static async bootstrap(
    config: EngineBootstrapConfig,
    deploySpec: string,
    projectSlug: string,
    phase: DeployPhase,
  ): Promise<DeployClient> {
    const res = await fetch(`${API_BASE}/prototype/api/bootstrap-deploy-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        model: config.model,
        base_url: config.baseUrl ?? "",
        deploy_spec: deploySpec,
        project_slug: projectSlug,
        phase,
      }),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = (await res.json()) as { id: string };
    const ws = new WebSocket(
      `${wsBaseUrl()}/sockets/events/${data.id}?resend_mode=all`,
    );
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Deploy WebSocket connection failed"));
    });
    return new DeployClient(data.id, phase, ws);
  }

  async sendMessage(text: string): Promise<void> {
    const res = await fetch(
      `${API_BASE}/api/conversations/${this.conversationId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content: [{ type: "text", text }],
          run: true,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  subscribe(handler: (event: EngineEvent) => void): () => void {
    const onMessage = (message: MessageEvent<string>) => {
      try {
        handler(JSON.parse(message.data) as EngineEvent);
      } catch {
        // Ignore malformed frames.
      }
    };
    this.ws.addEventListener("message", onMessage);
    return () => this.ws.removeEventListener("message", onMessage);
  }

  close(): void {
    this.ws.close();
  }
}

export { extractExecutionStatus };
