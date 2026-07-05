import {
  BUILD_CAPABILITY,
  hasOutOfScopeNeeds,
  outOfScopeNeedLabels,
  PRODUCT_POSITIONING,
} from "../engine/buildCapability";
import type { RequirementsData } from "../types";
import { fieldsReadyForRequirements } from "../engine/gateReadiness";
import { CanvasTabs } from "./CanvasTabs";

interface RequirementsCanvasProps {
  requirements: RequirementsData;
  complete: boolean;
  confirmed: boolean;
  fromChat?: boolean;
  onAcknowledgeFeasibility?: () => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-ink-softer/40 p-4">
      <h3 className="mb-2 text-sm font-semibold text-paper">{title}</h3>
      <div className="text-sm leading-6 text-paper-dim">{children}</div>
    </section>
  );
}

function CapabilityPanel({
  requirements,
  onAcknowledgeFeasibility,
}: {
  requirements: RequirementsData;
  onAcknowledgeFeasibility?: () => void;
}) {
  const outOfScope = hasOutOfScopeNeeds(requirements);
  const needLabels = outOfScopeNeedLabels(requirements);

  return (
    <div className="space-y-4">
      <p className="text-xs leading-6 text-stone">{PRODUCT_POSITIONING}</p>
      <Section title="本版支持">
        <ul className="list-disc space-y-1 pl-5">
          {BUILD_CAPABILITY.supports.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      <Section title="暂不支持（后续版本）">
        <ul className="list-disc space-y-1 pl-5">
          {BUILD_CAPABILITY.notYet.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      {outOfScope && !requirements.feasibilityAcknowledged && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
          <p className="text-sm font-medium text-amber-200">部分需求超出本版建造能力</p>
          <p className="mt-2 text-xs leading-6 text-amber-100/80">
            你的需求包含：{needLabels.join("、")}。这部分首版将以 mock 演示；数据保存、登录等其余功能为真实可用。
          </p>
          {onAcknowledgeFeasibility && (
            <button
              type="button"
              onClick={onAcknowledgeFeasibility}
              className="stagent-btn stagent-btn--primary stagent-btn--sm mt-4"
            >
              我已了解，继续
            </button>
          )}
        </div>
      )}
      {outOfScope && requirements.feasibilityAcknowledged && (
        <p className="rounded-lg border border-pine/30 bg-pine/10 px-3 py-2 text-xs text-pine-tint">
          已确认：第三方集成部分将以 mock 演示交付，其余功能真实可用。
        </p>
      )}
    </div>
  );
}

function computeProgress(requirements: RequirementsData, complete: boolean) {
  if (complete) return 100;
  const fields = [
    requirements.goal,
    requirements.users,
    requirements.p0Features.length > 0,
    requirements.acceptance.length > 0,
    requirements.outOfScope.length > 0,
    requirements.timeline,
  ];
  const ratio = fields.filter(Boolean).length / fields.length;
  if (fieldsReadyForRequirements(requirements)) {
    return Math.max(Math.round(ratio * 100), 90);
  }
  return Math.round(ratio * 100);
}

export function RequirementsCanvas({
  requirements,
  complete,
  confirmed,
  fromChat,
  onAcknowledgeFeasibility,
}: RequirementsCanvasProps) {
  const progress = computeProgress(requirements, complete);
  const outOfScope = hasOutOfScopeNeeds(requirements);

  const chatBanner = fromChat && !confirmed && (
    <p className="mb-3 rounded-lg border border-cinnabar/40 bg-ink-softer px-3 py-2 text-xs text-cinnabar-tint">
      以下内容由对话自动同步，请核对后点击底部「确认需求」。
    </p>
  );

  const capabilityTab = {
    id: "capability",
    label: "本版能力",
    badge: outOfScope && !requirements.feasibilityAcknowledged ? "!" : undefined,
    content: (
      <CapabilityPanel
        requirements={requirements}
        onAcknowledgeFeasibility={onAcknowledgeFeasibility}
      />
    ),
  };

  const tabs = complete
    ? [
        {
          id: "overview",
          label: "文档概览",
          badge: confirmed ? "已确认" : "待确认",
          content: (
            <div className="space-y-4">
              {chatBanner}
              <Section title="一句话目标">{requirements.goal}</Section>
              <Section title="给谁用">{requirements.users}</Section>
            </div>
          ),
        },
        {
          id: "features",
          label: "功能列表",
          content: (
            <Section title="功能列表">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-rose-600">P0 必须有</div>
                  <ul className="list-disc space-y-1 pl-5">
                    {requirements.p0Features.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                {requirements.p1Features.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-amber-600">P1 最好有</div>
                    <ul className="list-disc space-y-1 pl-5">
                      {requirements.p1Features.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          ),
        },
        {
          id: "acceptance",
          label: "验收标准",
          content: (
            <Section title="验收标准">
              <ul className="space-y-2">
                {requirements.acceptance.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">□</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ),
        },
        {
          id: "scope",
          label: "范围与时间",
          content: (
            <div className="space-y-4">
              <Section title="不做什么">
                <ul className="list-disc space-y-1 pl-5">
                  {requirements.outOfScope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
              <Section title="时间预期">{requirements.timeline}</Section>
            </div>
          ),
        },
        capabilityTab,
      ]
    : [
        {
          id: "overview",
          label: "概览",
          badge: progress > 0 && progress < 100 ? `${progress}%` : undefined,
          content: (
            <div className="space-y-4">
              {chatBanner}
              <div className="grid gap-3 sm:grid-cols-2">
                <Section title="一句话目标">
                  {requirements.goal || "等待你在左侧回答…"}
                </Section>
                <Section title="给谁用">
                  {requirements.users || "等待补充"}
                </Section>
              </div>
            </div>
          ),
        },
        {
          id: "features",
          label: "功能",
          content: (
            <Section title="核心功能 P0">
              {requirements.p0Features.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {requirements.p0Features.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                "等待补充"
              )}
            </Section>
          ),
        },
        {
          id: "acceptance",
          label: "验收",
          content: (
            <Section title="验收标准">
              {requirements.acceptance.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {requirements.acceptance.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                "等待补充"
              )}
            </Section>
          ),
        },
        {
          id: "scope",
          label: "范围",
          content: (
            <div className="space-y-4">
              <Section title="不做什么">
                {requirements.outOfScope.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {requirements.outOfScope.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  "等待补充"
                )}
              </Section>
              <Section title="时间预期">
                {requirements.timeline || "等待补充"}
              </Section>
            </div>
          ),
        },
        capabilityTab,
      ];

  return <CanvasTabs tabs={tabs} />;
}
