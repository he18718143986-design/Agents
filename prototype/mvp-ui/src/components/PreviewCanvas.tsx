import { useEffect, useMemo, useState } from "react";
import type { RequirementsData } from "../types";
import { buildScenarioPreview } from "../engine/scenarioPreview";
import { CanvasTabs } from "./CanvasTabs";

interface PreviewCanvasProps {
  requirements: RequirementsData;
  buildProgress: number;
  buildDone: boolean;
  buildRunning: boolean;
  buildPreviewUrl: string | null;
  buildError: string | null;
  useMockPreview: boolean;
  acceptanceChecks: [boolean, boolean, boolean];
  styleWarmth: number;
  onToggleAcceptance: (index: number) => void;
}

const BUILD_STEPS = [
  { label: "已启动 workspace Agent", threshold: 10 },
  { label: "正在编写代码", threshold: 45 },
  { label: "准备 workspace 预览", threshold: 85 },
];

function WorkspacePreview({ url }: { url: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone">
        以下为 agent-server workspace 中的真实 index.html（静态托管）。
      </p>
      <div className="overflow-hidden rounded-xl border border-hairline bg-ink-soft">
        <iframe
          title="Workspace 预览"
          src={url}
          className="h-[min(520px,70vh)] w-full bg-paper"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-cinnabar-tint hover:underline"
      >
        在新标签页打开
      </a>
    </div>
  );
}

function metricToneClass(tone: "default" | "warn" | "ok" = "default"): string {
  if (tone === "warn") return "text-rose-400";
  if (tone === "ok") return "text-pine-tint";
  return "text-paper";
}

function ScenarioPreview({
  requirements,
  warmth,
}: {
  requirements: RequirementsData;
  warmth: number;
}) {
  const model = useMemo(
    () => buildScenarioPreview(requirements),
    [requirements],
  );
  const isWarm = warmth > 55;
  const primary = isWarm ? "#ea580c" : "#2563eb";

  if (model.layout === "dashboard") {
    return (
      <div
        className="rounded-2xl border bg-ink-soft p-4 shadow-sm"
        style={{ borderColor: isWarm ? "#fed7aa" : "#dbeafe" }}
      >
        <div className="mb-4 text-sm font-semibold text-paper">{model.headline}</div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {model.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-hairline bg-ink-softer px-3 py-3"
            >
              <div className="text-xs text-stone">{metric.label}</div>
              <div
                className={`mt-1 text-lg font-semibold ${metricToneClass(metric.tone)}`}
              >
                {metric.value}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {model.featurePanels.map((panel) => (
            <div
              key={panel.title}
              className="rounded-xl border border-hairline bg-ink-softer p-3"
            >
              <div className="text-sm font-medium text-paper">{panel.title}</div>
              <p className="mt-1 text-xs leading-5 text-paper-dim">{panel.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium text-paper"
            style={{ background: primary }}
          >
            {model.primaryAction}
          </button>
          <button
            type="button"
            className="rounded-xl border border-hairline bg-ink-soft px-4 py-2 text-sm text-paper-dim"
          >
            {model.secondaryAction}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border bg-ink-soft p-4 shadow-sm"
      style={{ borderColor: isWarm ? "#fed7aa" : "#dbeafe" }}
    >
      <div className="rounded-xl border bg-ink-softer p-4" style={{ borderColor: isWarm ? "#ffedd5" : "#e2e8f0" }}>
        <div className="mb-3 text-sm font-medium text-paper">{model.headline}</div>
        <div className="grid gap-3 md:grid-cols-2">
          {model.featurePanels.map((panel) => (
            <label key={panel.title} className="block text-xs text-paper-dim">
              {panel.title}
              <input
                className="mt-1 w-full rounded-lg border border-hairline bg-ink-soft px-3 py-2 text-sm"
                placeholder="待填写"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium text-paper"
            style={{ background: primary }}
          >
            {model.primaryAction}
          </button>
          <button
            type="button"
            className="rounded-xl border border-hairline bg-ink-soft px-4 py-2 text-sm text-paper-dim"
          >
            {model.secondaryAction}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PreviewCanvas({
  requirements,
  buildProgress,
  buildDone,
  buildRunning,
  buildPreviewUrl,
  buildError,
  useMockPreview,
  acceptanceChecks,
  styleWarmth,
  onToggleAcceptance,
}: PreviewCanvasProps) {
  const [activeTab, setActiveTab] = useState("progress");

  useEffect(() => {
    if (buildDone && activeTab === "progress") {
      setActiveTab("preview");
    }
  }, [buildDone, activeTab]);

  const acceptanceItems = requirements.acceptance.length
    ? requirements.acceptance
    : [
        "核心功能是否可用",
        "页面是否看得懂",
        "你是否愿意把这个链接发给别人试用",
      ];

  const tabs = [
    {
      id: "progress",
      label: "制作进度",
      badge: `${buildProgress}%`,
      content: (
        <div className="grid gap-3 sm:grid-cols-3">
          {BUILD_STEPS.map((step) => {
            const done = buildProgress >= step.threshold;
            const active =
              buildRunning && !done && buildProgress >= step.threshold - 20;
            return (
              <div
                key={step.label}
                className={[
                  "rounded-xl border p-4 text-sm",
                  done
                    ? "border-pine-tint/40 bg-pine/20 text-pine-tint"
                    : active
                      ? "border-pine-tint/40 bg-pine/20 text-pine-tint"
                      : "border-hairline bg-ink-soft text-stone",
                ].join(" ")}
              >
                <div className="font-medium">
                  {done ? "✅" : active ? "🔄" : "⏳"} {step.label}
                </div>
              </div>
            );
          })}
          {buildError ? (
            <p className="sm:col-span-3 text-xs leading-5 text-rose-400">{buildError}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "preview",
      label: "试用预览",
      disabled: !buildDone,
      badge: buildDone
        ? buildPreviewUrl
          ? "workspace"
          : "mock"
        : buildRunning
          ? "制作中"
          : "等待",
      content: buildDone ? (
        buildPreviewUrl && !useMockPreview ? (
          <WorkspacePreview url={buildPreviewUrl} />
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
              当前为静态演示版，数据不会真实保存。界面与流程供试用验收。
            </p>
            {!buildPreviewUrl || useMockPreview ? (
              <p className="text-xs text-stone">
                {useMockPreview
                  ? "已切换为需求场景 mock 预览。"
                  : "未检测到 workspace 页面，展示需求场景 mock。"}
              </p>
            ) : null}
            <ScenarioPreview requirements={requirements} warmth={styleWarmth} />
          </div>
        )
      ) : buildRunning ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline text-sm text-stone">
          workspace Agent 正在制作，请稍候…
        </div>
      ) : (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline text-sm text-stone">
          确认风格后将启动 workspace 制作 Agent
        </div>
      ),
    },
    {
      id: "acceptance",
      label: "验收清单",
      disabled: !buildDone,
      badge: buildDone
        ? `${acceptanceChecks.filter(Boolean).length}/3`
        : undefined,
      content: buildDone ? (
        <div className="space-y-3">
          {acceptanceItems.slice(0, 3).map((item, index) => (
            <label
              key={item}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-3 hover:bg-ink-softer"
            >
              <input
                type="checkbox"
                checked={acceptanceChecks[index]}
                onChange={() => onToggleAcceptance(index)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-paper">{item}</div>
                <div className="text-xs text-stone">请实际操作后勾选</div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline text-sm text-stone">
          试用后在此 Tab 勾选验收项
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {buildDone && buildPreviewUrl && !useMockPreview && (
        <p className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          当前为静态演示版，数据不会真实保存。
        </p>
      )}
      <CanvasTabs
        tabs={tabs}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
