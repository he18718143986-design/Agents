import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiConfigPanel } from "../components/ApiConfigPanel";
import { CanvasPanel } from "../components/CanvasPanel";
import { HomePage } from "../components/HomePage";
import { LeftSidebar } from "../components/LeftSidebar";
import { ResizableWorkspace } from "../components/ResizableWorkspace";
import { WorkspaceTopBar } from "../components/WorkspaceTopBar";
import { getQuickReplies } from "../components/ChatPanel";
import { loadStoredEngineConfig } from "../engine/apiConfig";
import {
  createMockProject,
  getMockProject,
  syncProjectFromWorkspace,
} from "../engine/projectCatalog";
import {
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "../engine/projectPersistence";
import type { MockProject } from "../mockProjects";
import { useAppFlow } from "../useAppFlow";

type AppView = "home" | "workspace";

export function AppShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<AppView>("home");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [openInIterationMode, setOpenInIterationMode] = useState(false);
  const handledNewActionRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const {
    state,
    sendUserMessage,
    selectPath,
    confirmPathSelfBuild,
    confirmPathBuy,
    confirmRequirements,
    selectTech,
    selectStyle,
    confirmStyle,
    completeAcceptance,
    confirmGoLive,
    pauseProject,
    acknowledgeFeasibility,
    enterIterationMode,
    revertToExplore,
    revertToRequirements,
    revertToStyle,
    revertToAcceptance,
    reopenRequirements,
    retryBuild,
    retryDeploy,
    acceptMockPreview,
    hydrateFromSnapshot,
    resetDemo,
    connectEngine,
    openApiConfig,
    closeApiConfig,
    dispatch,
  } = useAppFlow();

  const activeProject = activeProjectId ? getMockProject(activeProjectId) : undefined;
  const projectTitle =
    state.requirements.goal || activeProject?.title || "新项目";

  const enterWorkspace = useCallback(
    async (projectId: string, options?: { iteration?: boolean }) => {
      setActiveProjectId(projectId);
      setOpenInIterationMode(options?.iteration ?? false);
      setView("workspace");

      await resetDemo();

      const snapshot = loadProjectSnapshot(projectId);
      if (snapshot) {
        hydrateFromSnapshot(snapshot);
      }

      if (options?.iteration) {
        await enterIterationMode();
      }
    },
    [resetDemo, hydrateFromSnapshot, enterIterationMode],
  );

  const handleNewProject = useCallback(() => {
    const project = createMockProject();
    void enterWorkspace(project.id);
  }, [enterWorkspace]);

  const handleOpenProject = useCallback(
    (project: MockProject, iteration = false) => {
      void enterWorkspace(project.id, { iteration });
    },
    [enterWorkspace],
  );

  const handleGoHome = useCallback(() => {
    if (activeProjectId) {
      saveProjectSnapshot(activeProjectId, state);
    }
    setView("home");
    setOpenInIterationMode(false);
  }, [activeProjectId, state]);

  useEffect(() => {
    if (searchParams.get("action") !== "new" || handledNewActionRef.current) return;
    handledNewActionRef.current = true;
    const project = createMockProject();
    setActiveProjectId(project.id);
    setView("workspace");
    void resetDemo();
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, resetDemo]);

  useEffect(() => {
    if (view !== "workspace" || !activeProjectId) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveProjectSnapshot(activeProjectId, state);
    }, 500);

    syncProjectFromWorkspace(activeProjectId, {
      title: state.requirements.goal || undefined,
      summary:
        state.discoveryBrief.split("\n").filter(Boolean).slice(-1)[0] || undefined,
      stage: state.stage,
      status: state.projectStatus,
      completedAt:
        state.projectStatus === "completed" ? Date.now() : undefined,
    });

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [view, activeProjectId, state]);

  const quickReplies = getQuickReplies(state.stage);

  const chatDisabled =
    state.isAgentTyping ||
    (state.projectCompleted && !openInIterationMode && state.stage === 4) ||
    !state.engineReady;

  const sidebar = (
    <LeftSidebar
      stage={state.stage}
      projectCompleted={state.projectCompleted}
      pathEndedBuy={state.pathEndedBuy}
      iterationMode={state.iterationMode}
      messages={state.messages}
      isAgentTyping={state.isAgentTyping}
      quickReplies={quickReplies}
      onSend={(text) => void sendUserMessage(text)}
      chatDisabled={chatDisabled}
      engineError={state.engineError}
      pendingGate={state.pendingGate}
      pathChoice={state.pathChoice}
      discoveryReady={state.discoveryReady}
      requirementsComplete={state.requirementsComplete}
      selectedTechId={state.selectedTechId}
      selectedStyleId={state.selectedStyleId}
      buildDone={state.buildDone}
      buildError={state.buildError}
      buildRunning={state.buildRunning}
      stagingError={state.stagingError}
      stagingRunning={state.stagingRunning}
      productionError={state.productionError}
      productionRunning={state.productionRunning}
      acceptanceChecks={state.acceptanceChecks}
      stagingReady={state.stagingReady}
      goLiveChecks={state.goLiveChecks}
      onConfirmPathSelfBuild={() => void confirmPathSelfBuild()}
      onConfirmPathBuy={() => void confirmPathBuy()}
      onConfirmRequirements={() => void confirmRequirements()}
      onConfirmStyle={() => void confirmStyle()}
      onRequestChanges={() => void sendUserMessage("还不行，请继续修改")}
      onCompleteAcceptance={() => void completeAcceptance()}
      onConfirmGoLive={() => void confirmGoLive()}
      onPauseProject={() => void pauseProject()}
      onRevertToExplore={() => void revertToExplore()}
      onRevertToRequirements={() => void revertToRequirements()}
      onRevertToAcceptance={() => void revertToAcceptance()}
      onReopenRequirements={reopenRequirements}
      onEnterIteration={() => void enterIterationMode()}
      onRetryBuild={() => void retryBuild()}
      onRetryDeploy={(phase) => void retryDeploy(phase)}
      onAcceptMockPreview={() => void acceptMockPreview()}
    />
  );

  const canvas = (
    <main className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4 lg:p-5">
      <div className="flex h-full min-h-0 flex-col overflow-hidden stagent-panel shadow-sm">
        <CanvasPanel
          state={state}
          onSelectPath={selectPath}
          onSelectTech={selectTech}
          onSelectStyle={selectStyle}
          onToggleAcceptance={(index) =>
            dispatch({ type: "TOGGLE_ACCEPTANCE", index })
          }
          onToggleGoLiveCheck={(index) =>
            dispatch({ type: "TOGGLE_GO_LIVE_CHECK", index })
          }
          onAcknowledgeFeasibility={acknowledgeFeasibility}
        />
      </div>
    </main>
  );

  return (
    <>
      <ApiConfigPanel
        open={state.showApiConfig}
        isConnecting={state.engineConnecting}
        error={state.engineError}
        savedConfig={loadStoredEngineConfig()}
        onConnect={connectEngine}
        onClose={closeApiConfig}
        allowClose={state.engineReady}
      />

      {view === "home" ? (
        <HomePage
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          engineReady={state.engineReady}
          onOpenApiConfig={openApiConfig}
        />
      ) : (
        <div className="flex h-screen min-h-0 flex-col overflow-hidden stagent-shell bg-ink">
          <WorkspaceTopBar
            projectTitle={projectTitle}
            engineReady={state.engineReady}
            stage={state.stage}
            styleConfirmed={state.styleConfirmed}
            onGoHome={handleGoHome}
            onOpenApiConfig={openApiConfig}
            onReset={() => void resetDemo()}
            onRevertToRequirements={() => void revertToRequirements()}
            onRevertToStyle={() => void revertToStyle()}
          />
          <div className="min-h-0 flex-1">
            <ResizableWorkspace chat={sidebar} canvas={canvas} />
          </div>
        </div>
      )}
    </>
  );
}
