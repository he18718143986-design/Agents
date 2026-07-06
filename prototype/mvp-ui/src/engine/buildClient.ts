import type { EngineBootstrapConfig } from "./apiConfig";
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

export function workspacePreviewUrl(conversationId: string): string {
  return `/api/conversations/${conversationId}/workspace/index.html`;
}

export async function probeWorkspacePreview(
  conversationId: string,
): Promise<string | null> {
  const url = workspacePreviewUrl(conversationId);
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return url;
  } catch {
    // fall through
  }
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.ok) return url;
  } catch {
    // no preview
  }
  return null;
}

export function isActionEvent(event: EngineEvent): boolean {
  const kind = event.kind ?? "";
  return kind.includes("ActionEvent");
}

export function isBuildDoneSignal(event: EngineEvent): boolean {
  const text = extractAgentMessageText(event);
  return Boolean(text?.includes("[BUILD_DONE]"));
}

export class BuildClient {
  readonly conversationId: string;
  private ws: WebSocket;

  constructor(conversationId: string, ws: WebSocket) {
    this.conversationId = conversationId;
    this.ws = ws;
  }

  static async bootstrap(
    config: EngineBootstrapConfig,
    buildSpec: string,
    projectSlug: string,
    platformToken?: string,
  ): Promise<BuildClient> {
    const res = await fetch(`${API_BASE}/prototype/api/bootstrap-build-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        model: config.model,
        base_url: config.baseUrl ?? "",
        build_spec: buildSpec,
        project_slug: projectSlug,
        platform_token: platformToken ?? "",
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
      ws.onerror = () => reject(new Error("Build WebSocket connection failed"));
    });
    return new BuildClient(data.id, ws);
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
