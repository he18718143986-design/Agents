import type { DeployPhase } from "../engine/deployPrompt";
import type { GateType, Stage } from "../types";

interface FailurePlaybookProps {
  stage: Stage;
  pendingGate: GateType;
  buildError: string | null;
  buildRunning: boolean;
  buildDone: boolean;
  acceptanceChecks: [boolean, boolean, boolean];
  stagingError: string | null;
  productionError: string | null;
  stagingRunning: boolean;
  productionRunning: boolean;
  onRetryBuild: () => void;
  onRetryDeploy: (phase: DeployPhase) => void;
  onRevertToRequirements: () => void;
  onRevertToAcceptance: () => void;
  onAcceptMockPreview: () => void;
  onRequestChanges: () => void;
  onPauseProject: () => void;
}

function ErrorDetail({ message }: { message: string }) {
  return (
    <details className="text-xs text-stone">
      <summary className="cursor-pointer text-paper-dim hover:text-paper">
        技术详情
      </summary>
      <p className="mt-1 leading-5 text-rose-400/90">{message}</p>
    </details>
  );
}

export function FailurePlaybook({
  stage,
  pendingGate,
  buildError,
  buildRunning,
  buildDone,
  acceptanceChecks,
  stagingError,
  productionError,
  stagingRunning,
  productionRunning,
  onRetryBuild,
  onRetryDeploy,
  onRevertToRequirements,
  onRevertToAcceptance,
  onAcceptMockPreview,
  onRequestChanges,
  onPauseProject,
}: FailurePlaybookProps) {
  if (stage === 3 && buildError && !buildRunning) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-2">
        <p className="text-xs font-medium text-rose-200">制作遇到问题</p>
        <p className="text-xs leading-5 text-paper-dim">
          别担心，你可以重试制作、回到需求整理修改范围，或先用 mock 预览继续验收流程。
        </p>
        <ErrorDetail message={buildError} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onRetryBuild}
            className="stagent-btn stagent-btn--primary w-full !py-2 !text-sm"
          >
            重试制作
          </button>
          <button
            type="button"
            onClick={onRevertToRequirements}
            className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
          >
            改需求
          </button>
          <button
            type="button"
            onClick={onAcceptMockPreview}
            className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
          >
            继续用 mock 预览
          </button>
        </div>
      </div>
    );
  }

  if (
    stage === 3 &&
    buildDone &&
    !buildError &&
    pendingGate === "acceptance" &&
    !acceptanceChecks.every(Boolean)
  ) {
    return (
      <div className="rounded-xl border border-hairline bg-ink-softer/40 p-3 space-y-2">
        <p className="text-xs text-stone">
          验收清单勾不满？可以继续在对话里描述修改，或回到需求整理调整范围。
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onRequestChanges}
            className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
          >
            还不行，继续改
          </button>
          <button
            type="button"
            onClick={onRevertToRequirements}
            className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
          >
            改需求
          </button>
        </div>
      </div>
    );
  }

  if (stage === 4 && stagingError && !stagingRunning) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-2">
        <p className="text-xs font-medium text-rose-200">测试部署遇到问题</p>
        <p className="text-xs leading-5 text-paper-dim">
          可以重试部署，或回到制作验收阶段再检查一遍。
        </p>
        <ErrorDetail message={stagingError} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onRetryDeploy("staging")}
            className="stagent-btn stagent-btn--primary w-full !py-2 !text-sm"
          >
            重试测试部署
          </button>
          <button
            type="button"
            onClick={onRevertToAcceptance}
            className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
          >
            回到验收
          </button>
        </div>
      </div>
    );
  }

  if (stage === 4 && productionError && !productionRunning) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-2">
        <p className="text-xs font-medium text-rose-200">正式部署遇到问题</p>
        <p className="text-xs leading-5 text-paper-dim">
          可以重试上线，或先在测试环境继续试用。
        </p>
        <ErrorDetail message={productionError} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onRetryDeploy("production")}
            className="stagent-btn stagent-btn--primary w-full !py-2 !text-sm"
          >
            重试上线
          </button>
          <button
            type="button"
            onClick={onPauseProject}
            className="stagent-btn stagent-btn--ghost w-full !py-2 !text-sm"
          >
            暂停上线
          </button>
        </div>
      </div>
    );
  }

  return null;
}
