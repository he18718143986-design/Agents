import type { DeployPhase } from "../engine/deployPrompt";
import type { ChatMessage, GateType, PathChoice, Stage, TechChoice } from "../types";
import { ChatPanel } from "./ChatPanel";
import { FailurePlaybook } from "./FailurePlaybook";
import { GateBar } from "./GateBar";

interface LeftSidebarProps {
  stage: Stage;
  projectCompleted: boolean;
  pathEndedBuy: boolean;
  iterationMode: boolean;
  messages: ChatMessage[];
  isAgentTyping: boolean;
  quickReplies: string[];
  onSend: (text: string) => void;
  chatDisabled: boolean;
  engineError?: string | null;
  pendingGate: GateType;
  pathChoice: PathChoice;
  discoveryReady: boolean;
  requirementsComplete: boolean;
  requirementsReadyButAiSilent: boolean;
  onManualRequirementsComplete: () => void;
  selectedTechId: TechChoice;
  selectedStyleId: "A" | "B" | null;
  buildDone: boolean;
  buildError: string | null;
  buildRunning: boolean;
  stagingError: string | null;
  stagingRunning: boolean;
  productionError: string | null;
  productionRunning: boolean;
  acceptanceChecks: boolean[];
  stagingReady: boolean;
  goLiveChecks: boolean[];
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
  onRevertToAcceptance: () => void;
  onReopenRequirements: () => void;
  onEnterIteration: () => void;
  onRetryBuild: () => void;
  onRetryDeploy: (phase: DeployPhase) => void;
  onAcceptMockPreview: () => void;
}

export function LeftSidebar({
  stage,
  projectCompleted,
  pathEndedBuy,
  iterationMode,
  messages,
  isAgentTyping,
  quickReplies,
  onSend,
  chatDisabled,
  engineError,
  pendingGate,
  pathChoice,
  discoveryReady,
  requirementsComplete,
  requirementsReadyButAiSilent,
  onManualRequirementsComplete,
  selectedTechId,
  selectedStyleId,
  buildDone,
  buildError,
  buildRunning,
  stagingError,
  stagingRunning,
  productionError,
  productionRunning,
  acceptanceChecks,
  stagingReady,
  goLiveChecks,
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
  onRevertToAcceptance,
  onReopenRequirements,
  onEnterIteration,
  onRetryBuild,
  onRetryDeploy,
  onAcceptMockPreview,
}: LeftSidebarProps) {
  const gateBar = (
    <GateBar
      stage={stage}
      pendingGate={pendingGate}
      pathChoice={pathChoice}
      discoveryReady={discoveryReady}
      pathEndedBuy={pathEndedBuy}
      iterationMode={iterationMode}
      requirementsComplete={requirementsComplete}
      selectedTechId={selectedTechId}
      selectedStyleId={selectedStyleId}
      buildDone={buildDone}
      acceptanceChecks={acceptanceChecks}
      stagingReady={stagingReady}
      productionRunning={productionRunning}
      goLiveChecks={goLiveChecks}
      projectCompleted={projectCompleted}
      onConfirmPathSelfBuild={onConfirmPathSelfBuild}
      onConfirmPathBuy={onConfirmPathBuy}
      onConfirmRequirements={onConfirmRequirements}
      onConfirmStyle={onConfirmStyle}
      onRequestChanges={onRequestChanges}
      onCompleteAcceptance={onCompleteAcceptance}
      onConfirmGoLive={onConfirmGoLive}
      onPauseProject={onPauseProject}
      onRevertToExplore={onRevertToExplore}
      onRevertToRequirements={onRevertToRequirements}
      onReopenRequirements={onReopenRequirements}
      onEnterIteration={onEnterIteration}
      compact
    />
  );

  const failurePlaybook = (
    <FailurePlaybook
      stage={stage}
      pendingGate={pendingGate}
      buildError={buildError}
      buildRunning={buildRunning}
      buildDone={buildDone}
      acceptanceChecks={acceptanceChecks}
      stagingError={stagingError}
      productionError={productionError}
      stagingRunning={stagingRunning}
      productionRunning={productionRunning}
      onRetryBuild={onRetryBuild}
      onRetryDeploy={onRetryDeploy}
      onRevertToRequirements={onRevertToRequirements}
      onRevertToAcceptance={onRevertToAcceptance}
      onAcceptMockPreview={onAcceptMockPreview}
      onRequestChanges={onRequestChanges}
      onPauseProject={onPauseProject}
    />
  );

  // 人工兜底：字段齐全但 AI 未发就绪信号时，允许用户自行推进（实验 002 A2）
  const manualAdvance = requirementsReadyButAiSilent ? (
    <div className="rounded-xl border border-hairline bg-ink-softer/40 p-3 space-y-2">
      <p className="text-xs leading-5 text-stone">
        需求要点看起来已经齐全了。如果你觉得没问题，可以直接确认进入下一步。
      </p>
      <button
        type="button"
        onClick={onManualRequirementsComplete}
        className="stagent-btn stagent-btn--primary w-full !py-2 !text-sm"
      >
        需求已齐全，确认
      </button>
    </div>
  ) : null;

  const beforeInput = (
    <div className="space-y-2">
      {failurePlaybook}
      {manualAdvance}
      {gateBar}
    </div>
  );

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-ink-soft">
      {engineError && (
        <p className="shrink-0 px-4 pt-3 text-xs leading-5 text-cinnabar-tint">
          引擎连接失败：{engineError}
        </p>
      )}

      <ChatPanel
        messages={messages}
        isAgentTyping={isAgentTyping}
        quickReplies={quickReplies}
        onSend={onSend}
        disabled={chatDisabled}
        embedded
        beforeInput={beforeInput}
      />
    </aside>
  );
}
