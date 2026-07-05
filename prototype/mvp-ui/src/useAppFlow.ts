import { useCallback, useEffect, useReducer, useRef } from "react";
import { appReducer, initialState } from "./store";
import { detectBuildFeedback, detectStyleFeedback } from "./mockAgent";
import {
  OpenHandsClient,
  extractAgentMessageText,
  extractExecutionStatus,
} from "./engine/openhandsClient";
import {
  loadStoredEngineConfig,
  saveStoredEngineConfig,
  type EngineBootstrapConfig,
} from "./engine/apiConfig";
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
import type { AppState, ChatMessage, PathChoice, TechChoice } from "./types";
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
      clientRef.current = client;
      dispatch({ type: "SET_CONVERSATION_ID", id: client.conversationId });
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
    const saved = loadStoredEngineConfig();
    if (saved) {
      void bootstrapEngine({
        apiKey: saved.apiKey,
        model: saved.model,
        baseUrl: saved.baseUrl || undefined,
      });
    } else {
      dispatch({ type: "SET_SHOW_API_CONFIG", value: true });
    }
    return () => {
      initGenerationRef.current += 1;
      clientRef.current?.close();
      clientRef.current = null;
      buildUnsubRef.current?.();
      buildClientRef.current?.close();
      buildClientRef.current = null;
      deployUnsubRef.current?.();
      deployClientRef.current?.close();
      deployClientRef.current = null;
    };
  }, [bootstrapEngine]);

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
      } else if (current.stage === 3) {
        const feedback = detectBuildFeedback(text);
        if (feedback) {
          dispatch({ type: "REQUEST_CHANGES" });
          await pushAgentMessage(feedback, 400);
          await runRealBuild(text);
          return;
        }
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
    [runRealBuild, sendToEngine],
  );

  const selectPath = useCallback((choice: PathChoice) => {
    if (choice) {
      dispatch({ type: "SELECT_PATH", choice });
    }
  }, []);

  const confirmPathSelfBuild = useCallback(async () => {
    logStateAction({ type: "CONFIRM_PATH_SELF_BUILD" });
    dispatch({ type: "CONFIRM_PATH_SELF_BUILD" });
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
  }, [sendEngineSystemNotice]);

  const confirmPathBuy = useCallback(async () => {
    dispatch({ type: "CONFIRM_PATH_BUY" });
    const isSaas = stateRef.current.pathChoice === "saas";
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
  }, [sendEngineSystemNotice]);

  const confirmRequirements = useCallback(async () => {
    logStateAction({ type: "CONFIRM_REQUIREMENTS" });
    dispatch({ type: "CONFIRM_REQUIREMENTS" });
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
  }, [sendEngineSystemNotice]);

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
    await pushAgentMessage(
      "技术路线和风格已确认。正在启动 workspace 制作 Agent，请稍候…",
      500,
    );
    await runRealBuild();
  }, [pushAgentMessage, runRealBuild]);

  const completeAcceptance = useCallback(async () => {
    dispatch({ type: "COMPLETE_ACCEPTANCE" });
    await pushAgentMessage(
      "验收通过。正在启动测试环境部署 Agent，请稍候…",
      500,
    );
    await runDeploy("staging");
  }, [pushAgentMessage, runDeploy]);

  const confirmGoLive = useCallback(async () => {
    await pushAgentMessage("正在启动正式环境部署 Agent，请稍候…", 400);
    await runDeploy("production");
  }, [pushAgentMessage, runDeploy]);

  const pauseProject = useCallback(async () => {
    await pushAgentMessage(
      "好的，测试环境会保持可用。一周后再决定是否上线，或继续在对话里提出修改。",
    );
  }, [pushAgentMessage]);

  const acknowledgeFeasibility = useCallback(() => {
    dispatch({ type: "SET_FEASIBILITY_ACKNOWLEDGED" });
  }, []);

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
    await runRealBuild();
  }, [runRealBuild]);

  const retryDeploy = useCallback(
    async (phase: DeployPhase) => {
      if (phase === "staging") {
        dispatch({ type: "SET_STAGING_ERROR", error: null });
      } else {
        dispatch({ type: "SET_PRODUCTION_ERROR", error: null });
      }
      await runDeploy(phase);
    },
    [runDeploy],
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

  const hydrateFromSnapshot = useCallback((snapshot: Partial<AppState>) => {
    dispatch({ type: "HYDRATE_STATE", snapshot });
    hasUserMessageRef.current = (snapshot.messages?.length ?? 0) > 0;
  }, []);

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
    buildUnsubRef.current?.();
    buildClientRef.current?.close();
    buildClientRef.current = null;
    deployUnsubRef.current?.();
    deployClientRef.current?.close();
    deployClientRef.current = null;
    dispatch({ type: "RESET_DEMO" });
    const saved = loadStoredEngineConfig();
    if (saved) {
      await bootstrapEngine({
        apiKey: saved.apiKey,
        model: saved.model,
        baseUrl: saved.baseUrl || undefined,
      });
    } else {
      dispatch({ type: "SET_SHOW_API_CONFIG", value: true });
    }
  }, [bootstrapEngine]);

  useEffect(() => {
    logGateDiagnostics(state, "state.snapshot");
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
  };
}
