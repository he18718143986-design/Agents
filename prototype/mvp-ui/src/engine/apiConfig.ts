export interface EngineBootstrapConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Use LLM_API_KEY / DEEPSEEK_API_KEY configured on the server instead of a user key. */
  useServerKey?: boolean;
}

export interface StoredEngineConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  useServerKey?: boolean;
}

export interface EngineStatus {
  agentServer: boolean;
  envKey: boolean;
  model: string | null;
}

const STORAGE_KEY = "mvp-ui-engine-config";
const MODE_STORAGE_KEY = "mvp-ui-engine-mode";

export const MODEL_PRESETS = [
  {
    id: "deepseek-flash",
    label: "DeepSeek V4 Flash",
    model: "deepseek/deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    docsUrl: "https://api-docs.deepseek.com/zh-cn/",
  },
  {
    id: "deepseek-pro",
    label: "DeepSeek V4 Pro",
    model: "deepseek/deepseek-v4-pro",
    baseUrl: "https://api.deepseek.com",
    docsUrl: "https://api-docs.deepseek.com/zh-cn/",
  },
  {
    id: "openai",
    label: "OpenAI",
    model: "gpt-4o",
    baseUrl: "",
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "custom",
    label: "自定义",
    model: "",
    baseUrl: "",
    docsUrl: "",
  },
] as const;

/** Official DeepSeek API base URL (not the docs site). */
export const DEEPSEEK_API_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DOCS_URL = "https://api-docs.deepseek.com/zh-cn/";

export function loadStoredEngineConfig(): StoredEngineConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEngineConfig;
    if (!parsed.useServerKey && (!parsed.apiKey || !parsed.model)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredEngineConfig(config: EngineBootstrapConfig): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl ?? "",
      useServerKey: config.useServerKey ?? false,
    } satisfies StoredEngineConfig),
  );
}

export function clearStoredEngineConfig(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Persisted UI choice between real engine and scripted demo mode. */
export function loadStoredEngineMode(): "real" | "demo" | null {
  const raw = sessionStorage.getItem(MODE_STORAGE_KEY);
  return raw === "real" || raw === "demo" ? raw : null;
}

export function saveStoredEngineMode(mode: "real" | "demo"): void {
  sessionStorage.setItem(MODE_STORAGE_KEY, mode);
}

/**
 * Probe the dev/backend server: is agent-server reachable, and does the server
 * hold an LLM key (LLM_API_KEY / DEEPSEEK_API_KEY)? Returns null on static
 * hosting (e.g. GitHub Pages) where the endpoint does not exist.
 */
export async function fetchEngineStatus(): Promise<EngineStatus | null> {
  try {
    const res = await fetch("/prototype/api/engine-status", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<EngineStatus>;
    return {
      agentServer: data.agentServer === true,
      envKey: data.envKey === true,
      model: typeof data.model === "string" ? data.model : null,
    };
  } catch {
    return null;
  }
}
