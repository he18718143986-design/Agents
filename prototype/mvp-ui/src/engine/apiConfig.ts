export interface EngineBootstrapConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface StoredEngineConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

const STORAGE_KEY = "mvp-ui-engine-config";

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
    if (!parsed.apiKey || !parsed.model) return null;
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
    } satisfies StoredEngineConfig),
  );
}

export function clearStoredEngineConfig(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
