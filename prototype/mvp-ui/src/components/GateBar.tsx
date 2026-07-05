import type { GateType, PathChoice, Stage, TechChoice } from "../types";

interface GateBarProps {
  stage: Stage;
  pendingGate: GateType;
  pathChoice: PathChoice;
  discoveryReady: boolean;
  pathEndedBuy: boolean;
  iterationMode: boolean;
  requirementsComplete: boolean;
  selectedTechId: TechChoice;
  selectedStyleId: "A" | "B" | null;
  buildDone: boolean;
  acceptanceChecks: [boolean, boolean, boolean];
  stagingReady: boolean;
  goLiveChecks: [boolean, boolean, boolean];
  productionRunning?: boolean;
  projectCompleted: boolean;
  onConfirmPathSelfBuild: () => void;
  onConfirmPathBuy: () => void;
  onConfirmRequirements: () => void;
  onConfirmStyle: () => void;
  onRequestChanges: () => void;
  onCompleteAcceptance: () => void;
  onConfirmGoLive: () => void;
  onPauseProject: () => void;
  onRevertToExplore: () => void;
  onRevertToRequirements: () => void;
  onReopenRequirements: () => void;
  onEnterIteration: () => void;
  compact?: boolean;
}

export function GateBar({
  stage,
  pendingGate,
  pathChoice,
  discoveryReady,
  pathEndedBuy,
  iterationMode,
  requirementsComplete,
  selectedTechId,
  selectedStyleId,
  buildDone,
  acceptanceChecks,
  stagingReady,
  goLiveChecks,
  productionRunning = false,
  projectCompleted,
  onConfirmPathSelfBuild,
  onConfirmPathBuy,
  onConfirmRequirements,
  onConfirmStyle,
  onRequestChanges,
  onCompleteAcceptance,
  onConfirmGoLive,
  onPauseProject,
  onRevertToExplore,
  onRevertToRequirements,
  onReopenRequirements,
  onEnterIteration,
}: GateBarProps) {
  if (projectCompleted && !pathEndedBuy) {
    return (
      <div className="space-y-2">
        <p className="text-xs leading-5 text-pine-tint">项目已上线。</p>
        <button
          type="button"
          onClick={onEnterIteration}
          className="stagent-btn stagent-btn--primary w-full !py-2 !text-sm"
        >
          继续迭代
        </button>
      </div>
    );
  }

  if (pathEndedBuy) {
    return (
      <p className="text-xs leading-5 text-stone">
        外部方案已确认。请在右侧按引导完成开通。
      </p>
    );
  }

  let title: string | null = null;
  let primaryLabel: string | null = null;
  let primaryAction: (() => void) | null = null;
  let secondaryLabel: string | null = null;
  let secondaryAction: (() => void) | null = null;
  let disabled = false;

  if (stage === 0 && discoveryReady && pendingGate === "path" && !iterationMode) {
    if (pathChoice === "self_build") {
      title = "确认按自研路线继续";
      primaryLabel = "确认，开始整理需求";
      primaryAction = onConfirmPathSelfBuild;
      secondaryLabel = "改选其他方案";
      secondaryAction = onRevertToExplore;
    } else if (pathChoice === "saas" || pathChoice === "low_code") {
      title = "确认采用外部方案？";
      primaryLabel = "确认，查看实施建议";
      primaryAction = onConfirmPathBuy;
      secondaryLabel = "改选自研";
      secondaryAction = onRevertToExplore;
    } else {
      title = "请先在右侧选择一种方案";
    }
  }

  if (stage === 1 && requirementsComplete && pendingGate === "requirements") {
    title = "请确认需求文档后继续";
    primaryLabel = "确认需求，继续";
    primaryAction = onConfirmRequirements;
    secondaryLabel = "我还要改";
    secondaryAction = onReopenRequirements;
  }

  if (stage === 2 && pendingGate === "style") {
    title =
      selectedTechId && selectedStyleId
        ? "确认技术路线与界面风格"
        : "请先选择技术路线和界面风格";
    primaryLabel = "确认，开始制作";
    primaryAction = onConfirmStyle;
    secondaryLabel = "回到需求整理";
    secondaryAction = onRevertToRequirements;
    disabled = !selectedTechId || !selectedStyleId;
  }

  if (stage === 3 && buildDone && pendingGate === "acceptance") {
    const allChecked = acceptanceChecks.every(Boolean);
    title = allChecked ? "验收通过，进入部署准备" : "请试用后勾选验收清单";
    primaryLabel = "验收通过，继续";
    primaryAction = onCompleteAcceptance;
    secondaryLabel = "还不行，继续改";
    secondaryAction = onRequestChanges;
    disabled = !allChecked;
  }

  if (stage === 4 && stagingReady && pendingGate === "go_live") {
    const allChecked = goLiveChecks.every(Boolean);
    title = allChecked ? "确认上线正式环境" : "请完成上线检查项";
    primaryLabel = productionRunning ? "正在部署正式环境…" : "上线正式环境";
    primaryAction = onConfirmGoLive;
    secondaryLabel = "再测试一周";
    secondaryAction = onPauseProject;
    disabled = !allChecked || productionRunning;
  }

  if (!title && !primaryLabel && !secondaryLabel) {
    return null;
  }

  return (
    <div className="space-y-2">
      {title ? <p className="text-xs leading-5 text-stone">{title}</p> : null}
      {(primaryLabel || secondaryLabel) && (
        <div className="flex flex-col gap-2">
          {primaryLabel && primaryAction && (
            <button
              type="button"
              onClick={primaryAction}
              disabled={disabled}
              className="stagent-btn stagent-btn--primary w-full !py-2 !text-sm"
            >
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction}
              className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
