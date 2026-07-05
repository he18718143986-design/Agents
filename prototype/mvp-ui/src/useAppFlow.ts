import { useCallback, useEffect, useReducer, useRef } from "react";
import { appReducer, initialState } from "./store";
import { detectStyleFeedback } from "./mockAgent";
import {
  OpenHandsClient,
  extractAgentMessageText,
  extractExecutionStatus,
} from "./engine/openhandsClient";
import {
  loadStoredEngineConfig,
  loadStoredEngineMode,
  saveStoredEngineConfig,
  saveStoredEngineMode,
  type EngineBootstrapConfig,
} from "./engine/apiConfig";
import {
  demoChangeRequestReply,
  demoCoachReply,
  demoWelcomeText,
} from "./engine/demoCoach";
import { createDemoAppUrl, type DemoEnv } from "./engine/demoBuilder";
import { buildStageContext } from "./engine/stageContext";
import {
  BuildClient,
  extractExecutionStatus as extractBuildExecutionStatus,
  isActionEvent,
  isBuildDoneSignal,
  probeWorkspacePreview,
} from "./engine/buildClient";
import { formatBuildSpecMessage } from "./engine/buildPrompt";
import {
  DeployClient,
  extractExecutionStatus as extractDeployExecutionStatus,
  isActionEvent as isDeployActionEvent,
  isDeployReadySignal,
  probeDeployPreview,
} from "./engine/deployClient";
import type { DeployPhase } from "./engine/deployPrompt";
import { formatDeploySpec } from "./engine/deployPrompt";
import {
  parseCanvasPatchFromAgent,
  parseGateHintsFromAgent,
  splitCanvasPatch,
  stripCanvasBlocksForDisplay,
  summarizeCanvasPatchForChat,
  type CanvasPatch,
  type GateHints,
} from "./engine/parseCanvasPatch";
import type {
  AppState,
  ChatMessage,
  PathChoice,
  PersistedWorkspaceSnapshot,
  TechChoice,
} from "./types";
import {
  log,
  logCoachResponse,
  logGateDiagnostics,
  logStateAction,
  trackBuildSend,
  trackCoachSend,
  trackDeploySend,
  trackUserMessage,
} from "./engine/debugLog";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendDiscoveryBrief(brief: string, text: string): string {
  return brief ? `${brief}\n${text}` : text;
}

export function useAppFlow() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clientRef = useRef<OpenHandsClient | null>(null);
  const buildClientRef = useRef<BuildClient | null>(null);
  const buildUnsubRef = useRef<(() => void) | null>(null);
  const buildActionCountRef = useRef(0);
  const buildFinishHandledRef = useRef(false);
  const seenEventIdsRef = useRef(new Set<string>());
  const buildSeenEventIdsRef = useRef(new Set<string>());
  const deployClientRef = useRef<DeployClient | null>(null);
  const deployUnsubRef = useRef<(() => void) | null>(null);
  const deployActionCountRef = useRef(0);
  const deployFinishHandledRef = useRef(false);
  const initGenerationRef = useRef(0);
  const hasUserMessageRef = useRef(false);
  const demoRef = useRef({
    stageMessageCount: 0,
    changeLog: [] as string[],
    timers: [] as number[],
  });

  const clearDemoTimers = useCallback(() => {
    for (const timer of demoRef.current.timers) {
      window.clearTimeout(timer);
    }
    demoRef.current.timers = [];
  }, []);

  const isDemoMode = useCallback(
    () => stateRef.current.engineMode === "demo",
    [],
  );

  const pushAgentMessage = useCallback(async (content: string, pause = 700) => {
    dispatch({ type: "SET_AGENT_TYPING", value: true });
    await delay(pause);
    dispatch({
      type: "ADD_MESSAGE",
      message: createMessage("agent", content),
    });
    dispatch({ type: "SET_AGENT_TYPING", value: false });
  }, []);

  const sendToEngine = useCallback(async (text: string, contextState?: AppState) => {
    const client = clientRef.current;
    if (!client) {
      throw new Error("OpenHands engine is not ready");
    }
    const snapshot = contextState ?? stateRef.current;
    const payload = `${buildStageContext(snapshot)}\n\n用户消息：\n${text}`;
    trackCoachSend(payload);
    dispatch({ type: "SET_AGENT_TYPING", value: true });
    await client.sendMessage(payload);
  }, []);

  const sendEngineSystemNotice = useCallback(
    async (text: string) => {
      if (stateRef.current.engineMode === "demo") return;
      await sendToEngine(`[系统通知] ${text}`);
    },
    [sendToEngine],
  );

  const applyAgentStructuredPayload = useCallback(
    (patch: CanvasPatch | null, gateHints: GateHints) => {
      if (patch) {
        const {
          requirementsPatch,
          pathComparison,
          techGuidance,
          techRecommendation,
        } = splitCanvasPatch(patch);
        if (Object.keys(requirementsPatch).length > 0) {
          dispatch({
            type: "UPDATE_REQUIREMENTS",
            patch: requirementsPatch,
          });
          dispatch({ type: "SET_REQUIREMENTS_FROM_CHAT", value: true });
        }
        if (pathComparison) {
          dispatch({ type: "SET_PATH_COMPARISON", comparison: pathComparison });
        }
        if (techGuidance || techRecommendation) {
          dispatch({
            type: "SET_TECH_GUIDANCE",
            guidance: techGuidance ?? null,
            recommendation: techRecommendation ?? undefined,
          });
        }
      }
      if (gateHints.pathReady || gateHints.requirementsReady) {
        dispatch({ type: "SET_AI_GATE_HINTS", hints: gateHints });
      }
      queueMicrotask(() => {
        logGateDiagnostics(stateRef.current, "after.canvas-json");
      });
    },
    [],
  );

  const demoWarm = useCallback(
    () =>
      stateRef.current.styleWarmth > 55 || stateRef.current.selectedStyleId === "B",
    [],
  );

  const runDemoBuild = useCallback(
    async (changeRequest?: string) => {
      clearDemoTimers();
      if (changeRequest?.trim()) {
        demoRef.current.changeLog.push(changeRequest.trim());
      }
      dispatch({ type: "SET_BUILD_ERROR", error: null });
      dispatch({ type: "SET_BUILD_RUNNING", value: true });
      dispatch({ type: "SET_BUILD_PROGRESS", value: 10 });

      [30, 55, 80, 95].forEach((value, index) => {
        demoRef.current.timers.push(
          window.setTimeout(() => {
            dispatch({ type: "SET_BUILD_PROGRESS", value });
          }, 400 * (index + 1)),
        );
      });

      demoRef.current.timers.push(
        window.setTimeout(() => {
          const url = createDemoAppUrl({
            requirements: stateRef.current.requirements,
            warm: demoWarm(),
            env: "workspace",
            changeLog: demoRef.current.changeLog,
          });
          dispatch({ type: "SET_BUILD_RUNNING", value: false });
          dispatch({ type: "SET_BUILD_PREVIEW_URL", url });
          dispatch({ type: "SET_BUILD_DONE" });
          void pushAgentMessage(
            "第一版做好了（体验模式演示应用）。右侧「试用预览」可以真实操作：添加记录、删除、导出 CSV 都可用，数据保存在你的浏览器里。试用后请对照「验收清单」逐条勾选。",
            300,
          );
        }, 2200),
      );
    },
    [clearDemoTimers, demoWarm, pushAgentMessage],
  );

  const runDemoDeploy = useCallback(
    async (phase: DeployPhase) => {
      clearDemoTimers();
      const env: DemoEnv = phase === "staging" ? "staging" : "production";

      if (phase === "staging") {
        dispatch({ type: "SET_STAGING_ERROR", error: null });
        dispatch({ type: "SET_STAGING_RUNNING", value: true });
        dispatch({ type: "SET_STAGING_PROGRESS", value: 15 });
        [40, 70, 90].forEach((value, index) => {
          demoRef.current.timers.push(
            window.setTimeout(() => {
              dispatch({ type: "SET_STAGING_PROGRESS", value });
            }, 350 * (index + 1)),
          );
        });
        demoRef.current.timers.push(
          window.setTimeout(() => {
            const url = createDemoAppUrl({
              requirements: stateRef.current.requirements,
              warm: demoWarm(),
              env,
              changeLog: demoRef.current.changeLog,
            });
            dispatch({ type: "SET_STAGING_PREVIEW_URL", url });
            dispatch({ type: "SET_STAGING_ERROR", error: null });
            dispatch({ type: "SET_STAGING_READY" });
            void pushAgentMessage(
              "测试环境已就绪（体验模式）。请在右侧打开测试链接自测，建议也发给同事试用；确认没问题后勾选上线检查项，再决定是否正式上线。",
              300,
            );
          }, 1600),
        );
        return;
      }

      dispatch({ type: "SET_PRODUCTION_ERROR", error: null });
      dispatch({ type: "SET_PRODUCTION_RUNNING", value: true });
      demoRef.current.timers.push(
        window.setTimeout(() => {
          const url = createDemoAppUrl({
            requirements: stateRef.current.requirements,
            warm: demoWarm(),
            env,
            changeLog: demoRef.current.changeLog,
          });
          dispatch({ type: "SET_PRODUCTION_URL", url });
          dispatch({ type: "COMPLETE_GO_LIVE" });
          void pushAgentMessage(
            "已上线正式环境（体验模式）。右侧可以打开正式地址。提示：体验模式的应用运行在你的浏览器里，连接真实引擎后会部署到 workspace。",
            300,
          );
        }, 1400),
      );
    },
    [clearDemoTimers, demoWarm, pushAgentMessage],
  );

  const finalizeBuildRun = useCallback(
    async (conversationId: string) => {
      if (buildFinishHandledRef.current) return;
      buildFinishHandledRef.current = true;

      dispatch({ type: "SET_BUILD_RUNNING", value: false });
      const previewUrl = await probeWorkspacePreview(conversationId);
      if (previewUrl) {
        dispatch({ type: "SET_BUILD_PREVIEW_URL", url: previewUrl });
        dispatch({ type: "SET_BUILD_ERROR", error: null });
        dispatch({ type: "SET_BUILD_DONE" });
        await pushAgentMessage(
          "第一版已做好。右侧可试用 workspace 预览，并对照验收清单检查。",
          500,
        );
      } else {
        dispatch({ type: "SET_BUILD_PREVIEW_URL", url: null });
        dispatch({
          type: "SET_BUILD_ERROR",
          error: "制作 Agent 已结束，但未检测到 index.html。右侧暂用需求场景 mock。",
        });
        dispatch({ type: "SET_BUILD_DONE" });
        await pushAgentMessage(
          "制作流程已结束，但未找到可预览页面。右侧展示需求场景 mock，可在对话中描述修改后重试。",
          500,
        );
      }
    },
    [pushAgentMessage],
  );

  const attachBuildSubscription = useCallback(
    (client: BuildClient) => {
      buildUnsubRef.current?.();
      buildFinishHandledRef.current = false;
      buildActionCountRef.current = 0;
      buildSeenEventIdsRef.current.clear();

      buildUnsubRef.current = client.subscribe((event) => {
        const eventId = event.id;
        if (eventId) {
          if (buildSeenEventIdsRef.current.has(eventId)) return;
          buildSeenEventIdsRef.current.add(eventId);
        }

        if (isActionEvent(event)) {
          buildActionCountRef.current += 1;
          const bump = Math.min(12 + buildActionCountRef.current * 8, 92);
          dispatch({ type: "SET_BUILD_PROGRESS", value: bump });
        }

        if (isBuildDoneSignal(event)) {
          void finalizeBuildRun(client.conversationId);
        }

        const status = extractBuildExecutionStatus(event);
        if (status === "running") {
          dispatch({ type: "SET_BUILD_RUNNING", value: true });
        }
        if (status === "finished") {
          void finalizeBuildRun(client.conversationId);
        }
        if (status === "error") {
          dispatch({ type: "SET_BUILD_RUNNING", value: false });
          dispatch({
            type: "SET_BUILD_ERROR",
            error: "制作 Agent 运行出错。请查看 agent-server 日志或在对话中重试。",
          });
          log("build", "llm.error", { conversationId: client.conversationId });
        }
      });
    },
    [finalizeBuildRun],
  );

  const runRealBuild = useCallback(
    async (changeRequest?: string) => {
      const config = loadStoredEngineConfig();
      if (!config) {
        dispatch({
          type: "SET_BUILD_ERROR",
          error: "未找到 API 配置，无法启动制作 Agent。",
        });
        return;
      }

      dispatch({ type: "SET_BUILD_ERROR", error: null });
      dispatch({ type: "SET_BUILD_RUNNING", value: true });
      dispatch({ type: "SET_BUILD_PROGRESS", value: 8 });

      if (changeRequest?.trim() && buildClientRef.current) {
        try {
          const revision = `[修改请求]\n${changeRequest.trim()}`;
          trackBuildSend(revision, stateRef.current.buildProjectSlug ?? "unknown", true);
          await buildClientRef.current.sendMessage(revision);
          buildFinishHandledRef.current = false;
          return;
        } catch (error) {
          dispatch({
            type: "SET_BUILD_ERROR",
            error: error instanceof Error ? error.message : String(error),
          });
          dispatch({ type: "SET_BUILD_RUNNING", value: false });
          return;
        }
      }

      buildUnsubRef.current?.();
      buildClientRef.current?.close();
      buildClientRef.current = null;

      try {
        const spec = formatBuildSpecMessage(stateRef.current, changeRequest);
        const slug = stateRef.current.buildProjectSlug ?? `${Date.now().toString(36)}`;
        trackBuildSend(spec, slug, false);
        const client = await BuildClient.bootstrap(config, spec, slug);
        buildClientRef.current = client;
        dispatch({ type: "SET_BUILD_CONVERSATION", id: client.conversationId });
        dispatch({ type: "SET_BUILD_PROJECT_SLUG", slug });
        dispatch({ type: "SET_BUILD_PREVIEW_URL", url: null });
        attachBuildSubscription(client);
        dispatch({ type: "SET_BUILD_PROGRESS", value: 15 });
      } catch (error) {
        let message = error instanceof Error ? error.message : String(error);
        try {
          const parsed = JSON.parse(message) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // keep raw
        }
        dispatch({ type: "SET_BUILD_ERROR", error: message });
        dispatch({ type: "SET_BUILD_RUNNING", value: false });
        await pushAgentMessage(
          `制作 Agent 启动失败：${message}。请确认 agent-server 已运行且 API Key 有效。`,
          300,
        );
      }
    },
    [attachBuildSubscription, pushAgentMessage],
  );

  const finalizeDeployRun = useCallback(
    async (client: DeployClient) => {
      if (deployFinishHandledRef.current) return;
      deployFinishHandledRef.current = true;

      const phase = client.phase;
      const previewUrl = await probeDeployPreview(client.conversationId, phase);

      if (phase === "staging") {
        dispatch({ type: "SET_STAGING_RUNNING", value: false });
        if (previewUrl) {
          dispatch({ type: "SET_STAGING_PREVIEW_URL", url: previewUrl });
          dispatch({ type: "SET_STAGING_ERROR", error: null });
          dispatch({ type: "SET_STAGING_READY" });
          await pushAgentMessage(
            "测试环境已部署。请在右侧打开测试链接自测，勾选上线检查后决定是否正式上线。",
            500,
          );
        } else {
          dispatch({ type: "SET_STAGING_PREVIEW_URL", url: null });
          dispatch({
            type: "SET_STAGING_ERROR",
            error: "部署 Agent 已结束，但未检测到 staging/index.html。",
          });
          dispatch({ type: "SET_STAGING_READY" });
          await pushAgentMessage(
            "测试部署已结束，但未找到测试环境页面。可查看 agent-server 日志或在对话中重试。",
            500,
          );
        }
        return;
      }

      dispatch({ type: "SET_PRODUCTION_RUNNING", value: false });
      if (previewUrl) {
        dispatch({ type: "SET_PRODUCTION_URL", url: previewUrl });
        dispatch({ type: "SET_PRODUCTION_ERROR", error: null });
        dispatch({ type: "COMPLETE_GO_LIVE" });
        await pushAgentMessage(
          "已上线正式环境。右侧可复制正式地址和交付物说明。",
          500,
        );
      } else {
        dispatch({ type: "SET_PRODUCTION_URL", url: null });
        dispatch({
          type: "SET_PRODUCTION_ERROR",
          error: "正式部署 Agent 已结束，但未检测到 production/index.html。",
        });
        dispatch({ type: "COMPLETE_GO_LIVE" });
        await pushAgentMessage(
          "正式部署流程已结束，但未找到正式环境页面。请检查 workspace 或重试。",
          500,
        );
      }
    },
    [pushAgentMessage],
  );

  const attachDeploySubscription = useCallback(
    (client: DeployClient) => {
      deployUnsubRef.current?.();
      deployFinishHandledRef.current = false;
      deployActionCountRef.current = 0;

      deployUnsubRef.current = client.subscribe((event) => {
        if (isDeployActionEvent(event)) {
          deployActionCountRef.current += 1;
          const bump = Math.min(10 + deployActionCountRef.current * 10, 92);
          if (client.phase === "staging") {
            dispatch({ type: "SET_STAGING_PROGRESS", value: bump });
          }
        }

        if (isDeployReadySignal(event, client.phase)) {
          void finalizeDeployRun(client);
        }

        const status = extractDeployExecutionStatus(event);
        if (status === "running") {
          if (client.phase === "staging") {
            dispatch({ type: "SET_STAGING_RUNNING", value: true });
          } else {
            dispatch({ type: "SET_PRODUCTION_RUNNING", value: true });
          }
        }
        if (status === "finished") {
          void finalizeDeployRun(client);
        }
        if (status === "error") {
          if (client.phase === "staging") {
            dispatch({ type: "SET_STAGING_RUNNING", value: false });
            dispatch({
              type: "SET_STAGING_ERROR",
              error: "测试部署 Agent 运行出错。请查看 agent-server 日志。",
            });
          } else {
            dispatch({ type: "SET_PRODUCTION_RUNNING", value: false });
            dispatch({
              type: "SET_PRODUCTION_ERROR",
              error: "正式部署 Agent 运行出错。请查看 agent-server 日志。",
            });
          }
        }
      });
    },
    [finalizeDeployRun],
  );

  const runDeploy = useCallback(
    async (phase: DeployPhase) => {
      const config = loadStoredEngineConfig();
      const slug = stateRef.current.buildProjectSlug;
      if (!config) {
        const err = "未找到 API 配置，无法启动部署 Agent。";
        if (phase === "staging") {
          dispatch({ type: "SET_STAGING_ERROR", error: err });
        } else {
          dispatch({ type: "SET_PRODUCTION_ERROR", error: err });
        }
        return;
      }
      if (!slug) {
        const err = "未找到制作 workspace，请先完成阶段 3 制作。";
        if (phase === "staging") {
          dispatch({ type: "SET_STAGING_ERROR", error: err });
        } else {
          dispatch({ type: "SET_PRODUCTION_ERROR", error: err });
        }
        return;
      }

      deployUnsubRef.current?.();
      deployClientRef.current?.close();
      deployClientRef.current = null;

      if (phase === "staging") {
        dispatch({ type: "SET_STAGING_ERROR", error: null });
        dispatch({ type: "SET_STAGING_RUNNING", value: true });
        dispatch({ type: "SET_STAGING_PROGRESS", value: 8 });
      } else {
        dispatch({ type: "SET_PRODUCTION_ERROR", error: null });
        dispatch({ type: "SET_PRODUCTION_RUNNING", value: true });
      }

      try {
        const spec = formatDeploySpec(stateRef.current, phase);
        trackDeploySend(spec, phase, slug);
        const client = await DeployClient.bootstrap(config, spec, slug, phase);
        deployClientRef.current = client;
        if (phase === "staging") {
          dispatch({ type: "SET_STAGING_CONVERSATION", id: client.conversationId });
          dispatch({ type: "SET_STAGING_PREVIEW_URL", url: null });
          dispatch({ type: "SET_STAGING_PROGRESS", value: 15 });
        } else {
          dispatch({
            type: "SET_PRODUCTION_CONVERSATION",
            id: client.conversationId,
          });
          dispatch({ type: "SET_PRODUCTION_URL", url: null });
        }
        attachDeploySubscription(client);
      } catch (error) {
        let message = error instanceof Error ? error.message : String(error);
        try {
          const parsed = JSON.parse(message) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // keep raw
        }
        if (phase === "staging") {
          dispatch({ type: "SET_STAGING_ERROR", error: message });
          dispatch({ type: "SET_STAGING_RUNNING", value: false });
        } else {
          dispatch({ type: "SET_PRODUCTION_ERROR", error: message });
          dispatch({ type: "SET_PRODUCTION_RUNNING", value: false });
        }
        await pushAgentMessage(`部署 Agent 启动失败：${message}`, 300);
      }
    },
    [attachDeploySubscription, pushAgentMessage],
  );

  const bootstrapEngine = useCallback(async (config: EngineBootstrapConfig) => {
    const generation = ++initGenerationRef.current;
    clientRef.current?.close();
    clientRef.current = null;
    seenEventIdsRef.current.clear();
    hasUserMessageRef.current = false;

    dispatch({ type: "SET_ENGINE_CONNECTING", value: true });
    dispatch({ type: "SET_ENGINE_READY", value: false });
    dispatch({ type: "SET_ENGINE_ERROR", error: null });
    dispatch({ type: "SET_CONVERSATION_ID", id: null });
    dispatch({ type: "SET_SHOW_API_CONFIG", value: false });

    try {
      const client = await OpenHandsClient.bootstrap(config);
      if (generation !== initGenerationRef.current) {
        client.close();
        return;
      }

      saveStoredEngineConfig(config);
      saveStoredEngineMode("real");
      clientRef.current = client;
      dispatch({ type: "SET_CONVERSATION_ID", id: client.conversationId });
      dispatch({ type: "SET_ENGINE_MODE", mode: "real" });
      dispatch({ type: "SET_ENGINE_READY", value: true });

      client.subscribe((event) => {
        const eventId = event.id;
        if (eventId) {
          if (seenEventIdsRef.current.has(eventId)) return;
          seenEventIdsRef.current.add(eventId);
        }

        const agentText = extractAgentMessageText(event);
        if (agentText) {
          const patch = parseCanvasPatchFromAgent(agentText);
          const gateHints = parseGateHintsFromAgent(agentText);
          const split = patch ? splitCanvasPatch(patch) : null;
          logCoachResponse(agentText, {
            hasCanvasJson: /```canvas-json/i.test(agentText),
            patchKeys: split
              ? [
                  ...Object.keys(split.requirementsPatch),
                  ...(split.pathComparison ? ["pathComparison"] : []),
                  ...(split.techGuidance ? ["techGuidance"] : []),
                ]
              : [],
            gateHints: {
              pathReady: gateHints.pathReady === true,
              requirementsReady: gateHints.requirementsReady === true,
            },
          });
          if (hasUserMessageRef.current) {
            applyAgentStructuredPayload(patch, gateHints);
          }
          const displayText =
            stripCanvasBlocksForDisplay(agentText) ||
            (patch && hasUserMessageRef.current
              ? summarizeCanvasPatchForChat(patch)
              : "");
          if (displayText) {
            dispatch({
              type: "ADD_MESSAGE",
              message: createMessage("agent", displayText),
            });
          }
        }

        const status = extractExecutionStatus(event);
        if (status) {
          dispatch({
            type: "SET_AGENT_TYPING",
            value: status === "running",
          });
          if (status === "error") {
            dispatch({
              type: "SET_ENGINE_ERROR",
              error: "Agent 运行出错，请重试或检查 agent-server 日志。",
            });
          }
        }
      });
    } catch (error) {
      if (generation !== initGenerationRef.current) return;
      let message = error instanceof Error ? error.message : String(error);
      try {
        const parsed = JSON.parse(message) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // keep raw message
      }
      if (
        message.includes("aborted due to timeout") ||
        message.toLowerCase().includes("timeout")
      ) {
        message =
          "连接 agent-server 超时。请确认 agent-server 已在 127.0.0.1:8000 运行，并检查 API Key / Base URL 是否可达。";
      }
      dispatch({ type: "SET_ENGINE_ERROR", error: message });
      dispatch({ type: "SET_SHOW_API_CONFIG", value: true });
      dispatch({ type: "SET_AGENT_TYPING", value: false });
    } finally {
      if (generation === initGenerationRef.current) {
        dispatch({ type: "SET_ENGINE_CONNECTING", value: false });
      }
    }
  }, [applyAgentStructuredPayload]);

  const connectEngine = useCallback(
    (config: EngineBootstrapConfig) => {
      void bootstrapEngine(config);
    },
    [bootstrapEngine],
  );

  const connectDemo = useCallback(
    async (forceWelcome = false) => {
      initGenerationRef.current += 1;
      clientRef.current?.close();
      clientRef.current = null;
      clearDemoTimers();
      demoRef.current.stageMessageCount = 0;
      demoRef.current.changeLog = [];

      saveStoredEngineMode("demo");
      dispatch({ type: "SET_ENGINE_MODE", mode: "demo" });
      dispatch({ type: "SET_ENGINE_READY", value: true });
      dispatch({ type: "SET_ENGINE_CONNECTING", value: false });
      dispatch({ type: "SET_ENGINE_ERROR", error: null });
      dispatch({ type: "SET_SHOW_API_CONFIG", value: false });

      if (forceWelcome || stateRef.current.messages.length === 0) {
        await pushAgentMessage(demoWelcomeText(), 300);
      }
    },
    [clearDemoTimers, pushAgentMessage],
  );

  const openApiConfig = useCallback(() => {
    dispatch({ type: "SET_SHOW_API_CONFIG", value: true });
    dispatch({ type: "SET_ENGINE_ERROR", error: null });
  }, []);

  const closeApiConfig = useCallback(() => {
    if (stateRef.current.engineReady) {
      dispatch({ type: "SET_SHOW_API_CONFIG", value: false });
    }
  }, []);

  useEffect(() => {
    const savedMode = loadStoredEngineMode();
    const saved = loadStoredEngineConfig();
    if (savedMode === "demo") {
      void connectDemo();
    } else if (saved) {
      void bootstrapEngine({
        apiKey: saved.apiKey,
        model: saved.model,
        baseUrl: saved.baseUrl || undefined,
        useServerKey: saved.useServerKey,
      });
    } else {
      dispatch({ type: "SET_SHOW_API_CONFIG", value: true });
    }
    return () => {
      initGenerationRef.current += 1;
      clearDemoTimers();
      clientRef.current?.close();
      clientRef.current = null;
      buildUnsubRef.current?.();
      buildClientRef.current?.close();
      buildClientRef.current = null;
      deployUnsubRef.current?.();
      deployClientRef.current?.close();
      deployClientRef.current = null;
    };
  }, [bootstrapEngine, connectDemo, clearDemoTimers]);

  const sendUserMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || stateRef.current.isAgentTyping || !stateRef.current.engineReady) {
        return;
      }

      dispatch({
        type: "ADD_MESSAGE",
        message: createMessage("user", text),
      });
      const current = stateRef.current;
      trackUserMessage(text, current.stage);
      hasUserMessageRef.current = true;
      const demoMode = current.engineMode === "demo";
      let nextState = current;

      if (current.stage === 0 && !current.pathEndedBuy) {
        const brief = appendDiscoveryBrief(current.discoveryBrief, text);
        dispatch({ type: "UPDATE_DISCOVERY", brief });
        nextState = { ...current, discoveryBrief: brief };
      } else if (current.stage === 2 && !current.styleConfirmed) {
        const feedback = detectStyleFeedback(text);
        if (feedback) {
          dispatch({
            type: "ADJUST_STYLE",
            warmth: feedback.warmth,
            buttonSize: feedback.buttonSize,
          });
        }
      } else if (current.stage === 3 && current.awaitingChangeRequest) {
        // The next user message after「还不行，继续改」is the change request.
        dispatch({ type: "SET_AWAITING_CHANGE_REQUEST", value: false });
        await pushAgentMessage(demoChangeRequestReply(text), 300);
        if (demoMode) {
          await runDemoBuild(text);
        } else {
          await runRealBuild(text);
        }
        return;
      }

      if (demoMode) {
        dispatch({ type: "SET_AGENT_TYPING", value: true });
        await delay(650);
        const reply = demoCoachReply({
          stage: nextState.stage,
          text,
          requirements: nextState.requirements,
          userMessageCountInStage: demoRef.current.stageMessageCount,
        });
        demoRef.current.stageMessageCount += 1;
        applyAgentStructuredPayload(reply.patch, reply.gateHints);
        dispatch({
          type: "ADD_MESSAGE",
          message: createMessage("agent", reply.text),
        });
        dispatch({ type: "SET_AGENT_TYPING", value: false });
        return;
      }

      try {
        await sendToEngine(text, nextState);
      } catch (error) {
        dispatch({
          type: "SET_ENGINE_ERROR",
          error: error instanceof Error ? error.message : String(error),
        });
        dispatch({ type: "SET_AGENT_TYPING", value: false });
      }
    },
    [
      applyAgentStructuredPayload,
      pushAgentMessage,
      runDemoBuild,
      runRealBuild,
      sendToEngine,
    ],
  );

  const selectPath = useCallback((choice: PathChoice) => {
    if (choice) {
      dispatch({ type: "SELECT_PATH", choice });
    }
  }, []);

  const confirmPathSelfBuild = useCallback(async () => {
    logStateAction({ type: "CONFIRM_PATH_SELF_BUILD" });
    dispatch({ type: "CONFIRM_PATH_SELF_BUILD" });
    if (isDemoMode()) {
      demoRef.current.stageMessageCount = 0;
      await pushAgentMessage(
        "好，按自研路线继续。接下来把需求补全：目标用户是谁、怎样算验收通过、什么时候要用上。直接在对话里告诉我，我会帮你整理到右侧需求文档。",
        400,
      );
      return;
    }
    try {
      await sendEngineSystemNotice(
        "用户已在右侧确认走自研路线，进入需求整理阶段。请继续通过对话帮用户补全验收标准与时间预期。",
      );
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [isDemoMode, pushAgentMessage, sendEngineSystemNotice]);

  const confirmPathBuy = useCallback(async () => {
    dispatch({ type: "CONFIRM_PATH_BUY" });
    const isSaas = stateRef.current.pathChoice === "saas";
    if (isDemoMode()) {
      await pushAgentMessage(
        isSaas
          ? "好的，外部 SaaS 方案已确认。右侧是开通引导：建议先试用 1～2 家产品，再签年度合同。"
          : "好的，低代码方案已确认。右侧是开通步骤：先用免费版把核心台账搭出来验证流程。",
        400,
      );
      return;
    }
    try {
      await sendEngineSystemNotice(
        isSaas
          ? "用户已选择 SaaS 路线。请简要说明右侧欢迎引导页的用法。"
          : "用户已选择低代码路线。请简要说明右侧开通步骤。",
      );
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [isDemoMode, pushAgentMessage, sendEngineSystemNotice]);

  const confirmRequirements = useCallback(async () => {
    logStateAction({ type: "CONFIRM_REQUIREMENTS" });
    dispatch({ type: "CONFIRM_REQUIREMENTS" });
    if (isDemoMode()) {
      demoRef.current.stageMessageCount = 0;
      const reply = demoCoachReply({
        stage: 2,
        text: "",
        requirements: stateRef.current.requirements,
        userMessageCountInStage: 0,
      });
      applyAgentStructuredPayload(reply.patch, reply.gateHints);
      await pushAgentMessage(reply.text, 400);
      return;
    }
    try {
      await sendEngineSystemNotice(
        "用户已确认需求。请根据需求中的持久化/登录/集成需求，在 canvas-json 中输出 techGuidance 与 techRecommendation，并引导其在右侧选择技术路线和界面风格。",
      );
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    applyAgentStructuredPayload,
    isDemoMode,
    pushAgentMessage,
    sendEngineSystemNotice,
  ]);

  const selectTech = useCallback((techId: TechChoice) => {
    if (techId) {
      dispatch({ type: "SELECT_TECH", techId });
    }
  }, []);

  const selectStyle = useCallback((styleId: "A" | "B") => {
    dispatch({ type: "SELECT_STYLE", styleId });
  }, []);

  const confirmStyle = useCallback(async () => {
    logStateAction({ type: "CONFIRM_STYLE" });
    dispatch({ type: "CONFIRM_STYLE" });
    if (isDemoMode()) {
      await pushAgentMessage("技术路线和风格已确认。开始制作演示应用…", 400);
      await runDemoBuild();
      return;
    }
    await pushAgentMessage(
      "技术路线和风格已确认。正在启动 workspace 制作 Agent，请稍候…",
      500,
    );
    await runRealBuild();
  }, [isDemoMode, pushAgentMessage, runDemoBuild, runRealBuild]);

  const completeAcceptance = useCallback(async () => {
    dispatch({ type: "COMPLETE_ACCEPTANCE" });
    if (isDemoMode()) {
      await pushAgentMessage("验收通过。正在准备测试环境…", 400);
      await runDemoDeploy("staging");
      return;
    }
    await pushAgentMessage(
      "验收通过。正在启动测试环境部署 Agent，请稍候…",
      500,
    );
    await runDeploy("staging");
  }, [isDemoMode, pushAgentMessage, runDemoDeploy, runDeploy]);

  const confirmGoLive = useCallback(async () => {
    if (isDemoMode()) {
      await pushAgentMessage("正在发布正式环境…", 300);
      await runDemoDeploy("production");
      return;
    }
    await pushAgentMessage("正在启动正式环境部署 Agent，请稍候…", 400);
    await runDeploy("production");
  }, [isDemoMode, pushAgentMessage, runDemoDeploy, runDeploy]);

  const requestChanges = useCallback(async () => {
    dispatch({ type: "REQUEST_CHANGES" });
    dispatch({ type: "SET_AWAITING_CHANGE_REQUEST", value: true });
    await pushAgentMessage(
      "好的。请直接在对话里描述要修改的地方（例如：表格加一列负责人、导出按钮放最上面）。你发的下一条消息会作为修改要求交给制作 Agent。",
      300,
    );
  }, [pushAgentMessage]);

  const pauseProject = useCallback(async () => {
    await pushAgentMessage(
      "好的，测试环境会保持可用。一周后再决定是否上线，或继续在对话里提出修改。",
    );
  }, [pushAgentMessage]);

  const acknowledgeFeasibility = useCallback(() => {
    dispatch({ type: "SET_FEASIBILITY_ACKNOWLEDGED" });
    if (isDemoMode()) {
      // The demo coach's requirementsReady hint was suppressed while the
      // feasibility notice was pending; re-apply it now that it is cleared.
      dispatch({
        type: "SET_AI_GATE_HINTS",
        hints: { requirementsReady: true },
      });
    }
  }, [isDemoMode]);

  const enterIterationMode = useCallback(async () => {
    logStateAction({ type: "ENTER_ITERATION_MODE" });
    dispatch({ type: "ENTER_ITERATION_MODE" });
    try {
      await sendEngineSystemNotice(
        "用户进入迭代模式：保留已有需求与 workspace，从需求整理阶段开始。请协助调整需求后重新选型与制作。",
      );
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sendEngineSystemNotice]);

  const revertToExplore = useCallback(async () => {
    dispatch({ type: "REVERT_TO_EXPLORE" });
    try {
      await sendEngineSystemNotice("用户回到探索阶段，请协助重新评估路线。");
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sendEngineSystemNotice]);

  const revertToRequirements = useCallback(async () => {
    dispatch({ type: "REVERT_TO_REQUIREMENTS" });
    try {
      await sendEngineSystemNotice(
        "用户回到需求整理阶段，请协助修改需求文档。",
      );
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sendEngineSystemNotice]);

  const revertToStyle = useCallback(async () => {
    dispatch({ type: "REVERT_TO_STYLE" });
    try {
      await sendEngineSystemNotice(
        "用户回到风格选型阶段，请协助调整技术路线或界面风格。",
      );
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sendEngineSystemNotice]);

  const retryBuild = useCallback(async () => {
    dispatch({ type: "SET_BUILD_ERROR", error: null });
    dispatch({ type: "SET_USE_MOCK_PREVIEW", value: false });
    if (isDemoMode()) {
      await runDemoBuild();
      return;
    }
    await runRealBuild();
  }, [isDemoMode, runDemoBuild, runRealBuild]);

  const retryDeploy = useCallback(
    async (phase: DeployPhase) => {
      if (phase === "staging") {
        dispatch({ type: "SET_STAGING_ERROR", error: null });
      } else {
        dispatch({ type: "SET_PRODUCTION_ERROR", error: null });
      }
      if (isDemoMode()) {
        await runDemoDeploy(phase);
        return;
      }
      await runDeploy(phase);
    },
    [isDemoMode, runDemoDeploy, runDeploy],
  );

  const acceptMockPreview = useCallback(async () => {
    dispatch({ type: "SET_USE_MOCK_PREVIEW", value: true });
    dispatch({ type: "SET_BUILD_ERROR", error: null });
    dispatch({ type: "SET_BUILD_DONE" });
    await pushAgentMessage(
      "好的，右侧将使用需求场景 mock 预览。你可以继续对照验收清单，或在对话中描述修改。",
      400,
    );
  }, [pushAgentMessage]);

  const hydrateFromSnapshot = useCallback(
    (snapshot: Partial<PersistedWorkspaceSnapshot>) => {
      const next: Partial<AppState> = { ...snapshot };

      // Demo artifacts are Blob URLs that die on reload — regenerate them
      // from the persisted requirements so restored projects stay usable.
      const requirements = snapshot.requirements;
      if (requirements) {
        const warm =
          (snapshot.styleWarmth ?? 50) > 55 || snapshot.selectedStyleId === "B";
        const regenerate = (url: string | null | undefined, env: DemoEnv) =>
          url && url.startsWith("blob:")
            ? createDemoAppUrl({ requirements, warm, env, changeLog: [] })
            : url ?? null;
        next.buildPreviewUrl = regenerate(snapshot.buildPreviewUrl, "workspace");
        next.stagingPreviewUrl = regenerate(snapshot.stagingPreviewUrl, "staging");
        next.productionUrl = regenerate(snapshot.productionUrl, "production");
      }

      dispatch({ type: "HYDRATE_STATE", snapshot: next });
      hasUserMessageRef.current = (snapshot.messages?.length ?? 0) > 0;
    },
    [],
  );

  const revertToAcceptance = useCallback(async () => {
    dispatch({ type: "REVERT_TO_ACCEPTANCE" });
    try {
      await sendEngineSystemNotice("用户回到制作验收阶段，请协助对照验收清单。");
    } catch (error) {
      dispatch({
        type: "SET_ENGINE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sendEngineSystemNotice]);

  const reopenRequirements = useCallback(() => {
    dispatch({ type: "REOPEN_REQUIREMENTS" });
  }, []);

  const resetDemo = useCallback(async () => {
    clearDemoTimers();
    buildUnsubRef.current?.();
    buildClientRef.current?.close();
    buildClientRef.current = null;
    deployUnsubRef.current?.();
    deployClientRef.current?.close();
    deployClientRef.current = null;
    dispatch({ type: "RESET_DEMO" });
    const savedMode = loadStoredEngineMode();
    const saved = loadStoredEngineConfig();
    if (savedMode === "demo") {
      await connectDemo(true);
    } else if (saved) {
      await bootstrapEngine({
        apiKey: saved.apiKey,
        model: saved.model,
        baseUrl: saved.baseUrl || undefined,
        useServerKey: saved.useServerKey,
      });
    } else {
      dispatch({ type: "SET_SHOW_API_CONFIG", value: true });
    }
  }, [bootstrapEngine, clearDemoTimers, connectDemo]);

  useEffect(() => {
    logGateDiagnostics(stateRef.current, "state.snapshot");
  }, [
    state.stage,
    state.pendingGate,
    state.discoveryReady,
    state.requirementsComplete,
    state.requirements.feasibilityAcknowledged,
    state.projectCompleted,
    state.iterationMode,
  ]);

  return {
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
  };
}
