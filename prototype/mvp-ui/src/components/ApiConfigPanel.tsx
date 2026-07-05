import { useEffect, useState } from "react";
import {
  MODEL_PRESETS,
  type EngineBootstrapConfig,
  type StoredEngineConfig,
} from "../engine/apiConfig";

interface ApiConfigPanelProps {
  open: boolean;
  isConnecting: boolean;
  error: string | null;
  savedConfig: StoredEngineConfig | null;
  onConnect: (config: EngineBootstrapConfig) => void;
  onClose?: () => void;
  allowClose: boolean;
}

const DEV_SERVER_HINT = `cd 仓库根目录
export OPENHANDS_AGENT_SERVER_CONFIG_PATH="$(pwd)/prototype/agent-server.config.json"
uv run agent-server --host 127.0.0.1 --port 8000`;

function needsDevServerHint(message: string | null): boolean {
  if (!message) return false;
  return (
    message.includes("agent-server") ||
    message.includes("127.0.0.1:8000") ||
    message.includes("ECONNREFUSED") ||
    message.includes("无法连接")
  );
}

export function ApiConfigPanel({
  open,
  isConnecting,
  error,
  savedConfig,
  onConnect,
  onClose,
  allowClose,
}: ApiConfigPanelProps) {
  const [presetId, setPresetId] = useState("deepseek-flash");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>(MODEL_PRESETS[0].model);
  const [baseUrl, setBaseUrl] = useState<string>(MODEL_PRESETS[0].baseUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isCustom = presetId === "custom";

  useEffect(() => {
    if (!open) return;
    if (savedConfig) {
      const match = MODEL_PRESETS.find(
        (p) => p.model === savedConfig.model && p.baseUrl === (savedConfig.baseUrl ?? ""),
      );
      const nextPreset = match?.id ?? "custom";
      setPresetId(nextPreset);
      setModel(savedConfig.model);
      setBaseUrl(savedConfig.baseUrl ?? "");
      setApiKey("");
      setShowAdvanced(nextPreset === "custom");
    } else {
      setPresetId("deepseek-flash");
      setModel(MODEL_PRESETS[0].model);
      setBaseUrl(MODEL_PRESETS[0].baseUrl);
      setApiKey("");
      setShowAdvanced(false);
    }
  }, [open, savedConfig]);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = MODEL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (id === "custom") {
      setShowAdvanced(true);
      return;
    }
    setModel(preset.model);
    setBaseUrl(preset.baseUrl);
    setShowAdvanced(false);
  };

  const handleSubmit = () => {
    const key = apiKey.trim() || savedConfig?.apiKey || "";
    if (!key) return;
    if (!model.trim()) return;

    const config: EngineBootstrapConfig = {
      apiKey: key,
      model: model.trim(),
    };
    const trimmedBase = baseUrl.trim();
    if (trimmedBase) {
      config.baseUrl = trimmedBase;
    }
    onConnect(config);
  };

  if (!open) return null;

  const showDevHint = needsDevServerHint(error);

  return (
    <div className="stagent-modal-backdrop">
      <div className="stagent-modal" role="dialog" aria-labelledby="api-config-title">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="api-config-title" className="stagent-title text-lg">
              连接 AI
            </h2>
            <p className="mt-1 text-xs text-stone">密钥仅保存在当前标签页，关闭后清除。</p>
          </div>
          {allowClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-stone hover:bg-ink-softer hover:text-paper-dim"
              aria-label="关闭"
            >
              ✕
            </button>
          )}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-paper-dim">服务商</span>
            <select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="stagent-select"
            >
              {MODEL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-paper-dim">API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={savedConfig ? "留空则沿用已保存的密钥" : "sk-..."}
              autoComplete="off"
              className="stagent-input"
            />
          </label>

          {!isCustom && (
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="text-xs text-cinnabar-tint hover:text-paper"
            >
              {showAdvanced ? "收起高级设置" : "高级设置（模型 / 接口地址）"}
            </button>
          )}

          {(isCustom || showAdvanced) && (
            <div className="space-y-3 border-t border-hairline-soft pt-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-paper-dim">模型</span>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setPresetId("custom");
                    setModel(e.target.value);
                  }}
                  placeholder="deepseek/deepseek-v4-flash"
                  className="stagent-input"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-paper-dim">
                  API Base URL
                </span>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => {
                    setPresetId("custom");
                    setBaseUrl(e.target.value);
                  }}
                  placeholder="https://api.deepseek.com"
                  className="stagent-input"
                />
              </label>
            </div>
          )}
        </div>

        {error && <p className="stagent-alert stagent-alert--error mt-3">{error}</p>}

        {showDevHint && (
          <details className="mt-3 rounded-xl border border-hairline bg-ink p-3 text-xs text-stone">
            <summary className="cursor-pointer font-medium text-paper-dim">
              本地开发：先启动 agent-server
            </summary>
            <code className="mt-2 block whitespace-pre-wrap font-mono text-[10px] leading-5 text-stone">
              {DEV_SERVER_HINT}
            </code>
          </details>
        )}

        <button
          type="button"
          disabled={isConnecting || (!apiKey.trim() && !savedConfig?.apiKey) || !model.trim()}
          onClick={handleSubmit}
          className="stagent-btn stagent-btn--primary mt-4 w-full"
        >
          {isConnecting ? "连接中…" : "连接"}
        </button>
      </div>
    </div>
  );
}
