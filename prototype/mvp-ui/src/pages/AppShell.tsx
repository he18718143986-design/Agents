import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiConfigPanel } from "../components/ApiConfigPanel";
import { CanvasPanel } from "../components/CanvasPanel";
import { HomePage } from "../components/HomePage";
import { LeftSidebar } from "../components/LeftSidebar";
import { ResizableWorkspace } from "../components/ResizableWorkspace";
import { WorkspaceTopBar } from "../components/WorkspaceTopBar";
import { getQuickReplies } from "../engine/quickReplies";
import { loadStoredEngineConfig } from "../engine/apiConfig";
import {
  createProject,
  getProject,
  loadSnapshot,
  saveSnapshot,
} from "../engine/projectStore";
import type { MockProject } from "../mockProjects";
import { useAppFlow } from "../useAppFlow";

type AppView = "home" | "workspace";

export function AppShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<AppView>("home");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<MockProject | undefined>();
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
    requestChanges,
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
    connectDemo,
    openApiConfig,
    closeApiConfig,
    dispatch,
  } = useAppFlow();

  const projectTitle =
    state.requirements.goal || activeProject?.title || "新项目";

  const enterWorkspace = useCallback(
    async (projectId: string, options?: { iteration?: boolean }) => {
      setActiveProjectId(projectId);
      setOpenInIterationMode(options?.iteration ?? false);
      setView("workspace");
      void getProject(projectId).then(setActiveProject);

      await resetDemo();

      const snapshot = await loadSnapshot(projectId);
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
    void createProject().then((project) => enterWorkspace(project.id));
  }, [enterWorkspace]);

  const handleOpenProject = useCallback(
    (project: MockProject, iteration = false) => {
      void enterWorkspace(project.id, { iteration });
    },
    [enterWorkspace],
  );

  const handleGoHome = useCallback(() => {
    if (activeProjectId) {
      void saveSnapshot(activeProjectId, state);
    }
    setView("home");
    setOpenInIterationMode(false);
  }, [activeProjectId, state]);

  useEffect(() => {
    if (searchParams.get("action") !== "new" || handledNewActionRef.current) return;
    handledNewActionRef.current = true;
    void createProject().then((project) => {
      setActiveProjectId(project.id);
      setActiveProject(project);
      setView("workspace");
      void resetDemo();
    });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, resetDemo]);

  useEffect(() => {
    if (view !== "workspace" || !activeProjectId) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    // 云端保存有网络往返，去抖间隔比本地稍长
    saveTimerRef.current = window.setTimeout(() => {
      void saveSnapshot(activeProjectId, state);
    }, 1200);

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
      onRequestChanges={() => void requestChanges()}
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
        onDemoMode={() => void connectDemo()}
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
            engineMode={state.engineMode}
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
