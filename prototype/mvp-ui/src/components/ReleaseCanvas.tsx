import { CanvasTabs } from "./CanvasTabs";

interface ReleaseCanvasProps {
  stagingProgress: number;
  stagingReady: boolean;
  stagingRunning: boolean;
  stagingPreviewUrl: string | null;
  stagingError: string | null;
  goLiveChecks: [boolean, boolean, boolean];
  onToggleGoLiveCheck: (index: number) => void;
  projectCompleted: boolean;
  productionUrl: string | null;
  productionError: string | null;
  productionRunning: boolean;
  requirementsGoal: string;
}

const GO_LIVE_ITEMS = [
  "我已让同事在测试环境试用",
  "我确认数据会自动备份",
  "我了解出问题可以回退",
];

function DeployPreview({
  url,
  label,
}: {
  url: string;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone">{label}</p>
      <div className="overflow-hidden rounded-xl border border-hairline bg-ink-soft">
        <iframe
          title={label}
          src={url}
          className="h-[min(480px,65vh)] w-full bg-paper"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-block break-all text-xs text-cinnabar-tint hover:underline"
      >
        {url}
      </a>
    </div>
  );
}

export function ReleaseCanvas({
  stagingProgress,
  stagingReady,
  stagingRunning,
  stagingPreviewUrl,
  stagingError,
  goLiveChecks,
  onToggleGoLiveCheck,
  projectCompleted,
  productionUrl,
  productionError,
  productionRunning,
  requirementsGoal,
}: ReleaseCanvasProps) {
  if (projectCompleted) {
    return (
      <CanvasTabs
        tabs={[
          {
            id: "live",
            label: "正式地址",
            content: (
              <div className="space-y-4">
                <div className="rounded-xl border border-pine-tint/40 bg-pine/20 px-4 py-3 text-sm text-pine-tint">
                  已上线正式环境
                </div>
                {productionUrl ? (
                  <DeployPreview url={productionUrl} label="workspace 正式环境" />
                ) : (
                  <div className="rounded-xl border border-hairline bg-ink-softer p-4 text-sm text-paper-dim">
                    正式环境地址未检测到，请查看 agent-server workspace。
                  </div>
                )}
                {productionError ? (
                  <p className="text-xs text-rose-400">{productionError}</p>
                ) : null}
              </div>
            ),
          },
          {
            id: "handover",
            label: "交付物",
            content: (
              <ul className="list-disc space-y-2 pl-5 text-sm text-paper-dim">
                <li>{requirementsGoal || "需求文档"}（已锁定版本）</li>
                <li>应用 v1.0（workspace 静态部署）</li>
                <li>deploy/STAGING_README.md 与 deploy/PRODUCTION_README.md</li>
              </ul>
            ),
          },
        ]}
      />
    );
  }

  const tabs = [
    {
      id: "staging",
      label: "测试环境",
      badge: stagingReady
        ? stagingPreviewUrl
          ? "workspace"
          : "就绪"
        : stagingRunning
          ? `${stagingProgress}%`
          : "等待",
      content: stagingReady ? (
        <div className="space-y-4">
          {stagingPreviewUrl ? (
            <DeployPreview url={stagingPreviewUrl} label="workspace 测试环境" />
          ) : (
            <div className="rounded-xl border border-hairline bg-ink-softer p-4 text-sm text-paper-dim">
              测试部署已完成，但未检测到预览页面。
            </div>
          )}
          {stagingError ? (
            <p className="text-xs leading-5 text-rose-400">{stagingError}</p>
          ) : null}
          <p className="text-sm text-paper-dim">
            建议先让 2～3 位同事试用，确认无问题后再决定是否上线。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-ink-soft">
            <div
              className="h-full rounded-full bg-cinnabar transition-all duration-700"
              style={{ width: `${stagingProgress}%` }}
            />
          </div>
          <p className="text-sm text-stone">
            {stagingRunning
              ? "部署 Agent 正在准备测试环境…"
              : "验收通过后将自动启动测试部署"}
          </p>
          {stagingError ? (
            <p className="text-xs leading-5 text-rose-400">{stagingError}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "checklist",
      label: "上线检查",
      disabled: !stagingReady,
      badge: stagingReady
        ? `${goLiveChecks.filter(Boolean).length}/3`
        : undefined,
      content: stagingReady ? (
        <div className="space-y-3">
          {GO_LIVE_ITEMS.map((item, index) => (
            <label
              key={item}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-3 hover:bg-ink-softer"
            >
              <input
                type="checkbox"
                checked={goLiveChecks[index]}
                onChange={() => onToggleGoLiveCheck(index)}
                className="mt-1"
              />
              <span className="text-sm text-paper">{item}</span>
            </label>
          ))}
          {productionRunning ? (
            <p className="text-xs text-stone">正式部署 Agent 运行中…</p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-stone">
          测试环境就绪后，可在此勾选上线检查项
        </div>
      ),
    },
    {
      id: "prod",
      label: "正式环境",
      disabled: !projectCompleted && !productionUrl,
      content: productionUrl ? (
        <DeployPreview url={productionUrl} label="workspace 正式环境" />
      ) : (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-stone">
          {productionRunning
            ? "正式部署 Agent 运行中…"
            : "确认上线后，正式地址会出现在这里"}
        </div>
      ),
    },
  ];

  return <CanvasTabs tabs={tabs} />;
}
