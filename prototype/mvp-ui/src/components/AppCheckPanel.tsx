import { useState } from "react";

interface CheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  screenshot?: string;
}

interface CheckReport {
  status: "passed" | "failed" | "error";
  ranAt: string;
  durationMs: number;
  appTitle: string | null;
  checks: CheckItem[];
  consoleErrors: string[];
}

interface AppCheckPanelProps {
  conversationId: string;
  projectSlug: string;
}

/** 自动体检面板：一键跑确定性检查，展示逐项结果与截图证据。 */
export function AppCheckPanel({ conversationId, projectSlug }: AppCheckPanelProps) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/prototype/api/run-app-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          project_slug: projectSlug,
        }),
      });
      const data = (await res.json()) as CheckReport & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const screenshotUrl = (file: string) =>
    `/api/conversations/${conversationId}/workspace/${file}`;

  return (
    <div className="rounded-xl border border-hairline bg-ink-softer/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-paper">自动体检</div>
          <div className="text-xs text-stone">
            机器先跑一遍：加载、登录、各模块、真实录入、脚本错误——附截图证据
          </div>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void run()}
          className="stagent-btn stagent-btn--primary stagent-btn--sm shrink-0"
        >
          {running ? "体检中…（约半分钟）" : report ? "重新体检" : "运行体检"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs leading-5 text-rose-400">体检失败：{error}</p>
      )}

      {report && (
        <div className="mt-3 space-y-2">
          <p
            className={`text-xs font-medium ${
              report.status === "passed" ? "text-pine-tint" : "text-rose-300"
            }`}
          >
            {report.status === "passed" ? "✅ 全部通过" : "❌ 存在未通过项"} ·{" "}
            {report.checks.filter((check) => check.passed).length}/
            {report.checks.length} 项 · 耗时 {(report.durationMs / 1000).toFixed(1)}s
          </p>
          <ul className="space-y-1.5">
            {report.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2 text-xs leading-5">
                <span className={check.passed ? "text-pine-tint" : "text-rose-400"}>
                  {check.passed ? "✓" : "✗"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-paper">{check.label}</span>
                  <span className="text-stone"> — {check.detail}</span>
                  {check.screenshot && (
                    <>
                      {" "}
                      <a
                        href={screenshotUrl(check.screenshot)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cinnabar-tint hover:underline"
                      >
                        截图
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {report.consoleErrors.length > 0 && (
            <details className="text-xs text-stone">
              <summary className="cursor-pointer">
                页面错误（{report.consoleErrors.length}）
              </summary>
              <ul className="mt-1 space-y-1">
                {report.consoleErrors.map((message, index) => (
                  <li key={index} className="break-all text-rose-400/80">
                    {message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-[11px] text-stone">
            机器体检不替代你的业务判断——请仍按下方清单逐条实际操作确认。
          </p>
        </div>
      )}
    </div>
  );
}
