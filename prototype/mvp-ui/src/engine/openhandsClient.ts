import type { EngineBootstrapConfig } from "./apiConfig";
import { welcomeTriggerPayload } from "./welcomeTrigger";

export type EngineEvent = {
  id?: string;
  kind?: string;
  source?: string;
  key?: string;
  value?: unknown;
  llm_message?: {
    content?: { type?: string; text?: string }[];
  };
};

const API_BASE = import.meta.env.VITE_AGENT_SERVER_URL ?? "";

function wsBaseUrl(): string {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, "ws");
}

function isMessageEvent(event: EngineEvent): boolean {
  const kind = event.kind ?? "";
  return kind === "MessageEvent" || kind.endsWith(".MessageEvent");
}

function isStateUpdateEvent(event: EngineEvent): boolean {
  const kind = event.kind ?? "";
  return (
    kind === "ConversationStateUpdateEvent" ||
    kind.endsWith(".ConversationStateUpdateEvent")
  );
}

export function extractAgentMessageText(event: EngineEvent): string | null {
  if (!isMessageEvent(event) || event.source !== "agent") {
    return null;
  }
  const parts = event.llm_message?.content ?? [];
  const text = parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text as string)
    .join("\n")
    .trim();
  return text || null;
}

export function extractExecutionStatus(event: EngineEvent): string | null {
  if (!isStateUpdateEvent(event)) {
    return null;
  }
  if (event.key === "full_state" && event.value && typeof event.value === "object") {
    const status = (event.value as { execution_status?: string }).execution_status;
    return status ?? null;
  }
  if (event.key === "execution_status" && typeof event.value === "string") {
    return event.value;
  }
  return null;
}

export class OpenHandsClient {
  readonly conversationId: string;
  private ws: WebSocket;

  constructor(conversationId: string, ws: WebSocket) {
    this.conversationId = conversationId;
    this.ws = ws;
  }

  static async bootstrap(config: EngineBootstrapConfig): Promise<OpenHandsClient> {
    const res = await fetch(`${API_BASE}/prototype/api/bootstrap-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        model: config.model,
        base_url: config.baseUrl ?? "",
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
      ws.onerror = () => reject(new Error("WebSocket connection failed"));
    });

    void fetch(`${API_BASE}/api/conversations/${data.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(welcomeTriggerPayload()),
    }).catch(() => {
      // Welcome runs in the background; chat UI recovers via WebSocket events.
    });

    return new OpenHandsClient(data.id, ws);
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
