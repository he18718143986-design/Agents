import { PRODUCT_POSITIONING } from "../engine/buildCapability";
import { CanvasTabs } from "./CanvasTabs";
import { RequirementsDraftPreview } from "./RequirementsDraftPreview";
import type { PathChoice, PathComparison, RequirementsData } from "../types";

const PATH_OPTIONS = [
  {
    id: "saas" as const,
    name: "买现成 SaaS",
    summary: "最快上线，定制空间小",
    cost: "约 ¥3k/年",
    time: "1 天内",
    fit: "需求标准、追求速度",
  },
  {
    id: "low_code" as const,
    name: "低代码搭建",
    summary: "较快上线，有一定灵活性",
    cost: "约 ¥1k/年",
    time: "3 天左右",
    fit: "需求较简单、可自己调整",
  },
  {
    id: "self_build" as const,
    name: "自研开发",
    summary: "最灵活，周期较长",
    cost: "开发成本较高",
    time: "2～4 周首版",
    fit: "需求特殊、需深度定制",
    recommended: true,
  },
];

interface DiscoveryCanvasProps {
  discoveryBrief: string;
  pathChoice: PathChoice;
  pathComparison: PathComparison | null;
  requirements: RequirementsData;
  requirementsFromChat: boolean;
  hasUserInput: boolean;
  onSelectPath: (choice: PathChoice) => void;
}

function DiscoveryGuide() {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center">
      <div className="mx-auto w-full max-w-lg space-y-6 px-2 py-6 sm:px-4">
        <div className="rounded-2xl border border-cinnabar/30 bg-gradient-to-br from-ink-softer to-ink-soft p-6 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-cinnabar-tint">
            阶段 0 · 探索
          </div>
          <h2 className="mt-2 text-xl font-semibold text-paper">从想法开始</h2>
          <p className="mt-3 text-sm leading-7 text-paper-dim">
            在左侧和 Agent 聊聊你想解决的问题。不用写得很完整，一句话、一个痛点、一个场景都可以。
          </p>
          <p className="mt-2 text-xs leading-6 text-stone">{PRODUCT_POSITIONING}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-hairline bg-ink-soft p-4">
            <div className="text-sm font-medium text-paper">左侧 · 对话</div>
            <p className="mt-2 text-xs leading-6 text-stone">
              Agent 会帮你判断值不值得做，并整理需求要点。
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-hairline bg-ink-softer/80 p-4">
            <div className="text-sm font-medium text-stone">右侧 · 画布</div>
            <p className="mt-2 text-xs leading-6 text-stone">
              你描述想法后，这里会出现需求草稿、你的情况与方案对比。
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-stone">
          请先在左侧输入框发送你的第一条消息
        </p>
      </div>
    </div>
  );
}

function pathCoachNote(
  optionId: PathChoice,
  comparison: PathComparison | null,
): { fit?: string; caveat?: string } {
  if (!comparison || !optionId || optionId === null) return {};
  if (optionId === "saas") return comparison.saas ?? {};
  if (optionId === "low_code") return comparison.low_code ?? {};
  if (optionId === "self_build") return comparison.self_build ?? {};
  return {};
}

export function DiscoveryCanvas({
  discoveryBrief,
  pathChoice,
  pathComparison,
  requirements,
  requirementsFromChat,
  hasUserInput,
  onSelectPath,
}: DiscoveryCanvasProps) {
  if (!hasUserInput) {
    return <DiscoveryGuide />;
  }

  const hasDraft = requirements.p0Features.length > 0 || Boolean(requirements.goal);

  const compareTab = {
    id: "compare",
    label: "方案对比",
    content: (
      <div className="space-y-4">
        <p className="text-xs leading-6 text-stone">
          以下为通用路线参考（费用与周期为区间估计），用于判断值不值得自己做，并非针对你项目的实时报价。
        </p>
        {pathComparison?.competitorNote && (
          <p className="rounded-lg border border-hairline bg-ink-softer px-3 py-2 text-xs leading-6 text-paper-dim">
            {pathComparison.competitorNote}
          </p>
        )}
        <div className="grid gap-3 lg:grid-cols-3">
          {PATH_OPTIONS.map((option) => {
            const selected = pathChoice === option.id;
            const coach = pathCoachNote(option.id, pathComparison);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectPath(option.id)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-brass bg-ink-softer ring-2 ring-cinnabar/20"
                    : "border-hairline bg-ink-soft hover:border-cinnabar/40",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-semibold text-paper">{option.name}</div>
                  {option.recommended && (
                    <span className="rounded-full bg-ink-softer px-2 py-0.5 text-[10px] font-medium text-cinnabar-tint">
                      推荐
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm text-paper-dim">{option.summary}</p>
                {coach.fit && (
                  <p className="mb-2 text-xs leading-5 text-cinnabar-tint">
                    对你：{coach.fit}
                  </p>
                )}
                {coach.caveat && (
                  <p className="mb-3 text-xs leading-5 text-stone">{coach.caveat}</p>
                )}
                <dl className="space-y-1 text-xs text-stone">
                  <div className="flex justify-between gap-2">
                    <dt>费用</dt>
                    <dd className="text-paper-dim">{option.cost}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>周期</dt>
                    <dd className="text-paper-dim">{option.time}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>适合</dt>
                    <dd className="text-right text-paper-dim">
                      {coach.fit ? option.fit : option.fit}
                    </dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      </div>
    ),
  };

  const draftTab = {
    id: "draft",
    label: "需求草稿",
    badge: hasDraft ? `${requirements.p0Features.length || "✓"}` : undefined,
    content: (
      <div className="rounded-xl border border-hairline bg-ink-softer/40 p-4">
        <RequirementsDraftPreview
          requirements={requirements}
          fromChat={requirementsFromChat}
        />
      </div>
    ),
  };

  const contextTab = {
    id: "context",
    label: "你的情况",
    badge: discoveryBrief ? "已记录" : undefined,
    content: (
      <div className="rounded-xl border border-hairline bg-ink-softer/40 p-4 text-sm leading-6 text-paper-dim">
        {discoveryBrief || "在左侧简单描述你想解决的问题，Agent 会帮你更新这里的内容。"}
      </div>
    ),
  };

  const tabs = hasDraft
    ? [draftTab, compareTab, contextTab]
    : [compareTab, draftTab, contextTab];

  return <CanvasTabs tabs={tabs} />;
}
