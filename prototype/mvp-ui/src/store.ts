import type { AppAction, AppState, RequirementsData } from "./types";
import { emptyAcceptanceChecks } from "./engine/acceptance";
import { hasOutOfScopeNeeds } from "./engine/buildCapability";
import { applyGateSync } from "./engine/gateReadiness";

export const initialRequirements: RequirementsData = {
  goal: "",
  users: "",
  p0Features: [],
  p1Features: [],
  acceptance: [],
  outOfScope: [],
  timeline: "",
  needsPersistence: false,
  needsAuth: false,
  needsIntegration: false,
  feasibilityAcknowledged: false,
};

export const initialState: AppState = {
  stage: 0,
  messages: [],
  discoveryBrief: "",
  discoveryReady: false,
  pathChoice: null,
  pathEndedBuy: false,
  pathComparison: null,
  requirements: initialRequirements,
  requirementsComplete: false,
  requirementsConfirmed: false,
  selectedTechId: null,
  selectedStyleId: null,
  styleVersion: 1,
  styleConfirmed: false,
  techGuidance: null,
  techRecommendation: null,
  buildProgress: 0,
  buildDone: false,
  buildRunning: false,
  buildConversationId: null,
  buildProjectSlug: null,
  buildPreviewUrl: null,
  buildError: null,
  useMockPreview: false,
  acceptanceChecks: [],
  acceptanceCompleted: false,
  awaitingChangeRequest: false,
  stagingProgress: 0,
  stagingReady: false,
  stagingRunning: false,
  stagingConversationId: null,
  stagingPreviewUrl: null,
  stagingError: null,
  productionRunning: false,
  productionConversationId: null,
  productionUrl: null,
  productionError: null,
  goLiveChecks: [false, false, false],
  projectCompleted: false,
  projectStatus: "active",
  iterationMode: false,
  pendingGate: null,
  isAgentTyping: false,
  engineReady: false,
  engineMode: null,
  engineConnecting: false,
  showApiConfig: true,
  engineError: null,
  conversationId: null,
  requirementsFromChat: false,
  aiGateHints: { pathReady: false, requirementsReady: false },
  styleWarmth: 50,
  styleButtonSize: 50,
};

function mergeRequirementsPatch(
  current: RequirementsData,
  patch: Partial<RequirementsData>,
): RequirementsData {
  const next = { ...current, ...patch };
  const needsChanged =
    (patch.needsPersistence !== undefined &&
      patch.needsPersistence !== current.needsPersistence) ||
    (patch.needsAuth !== undefined && patch.needsAuth !== current.needsAuth) ||
    (patch.needsIntegration !== undefined &&
      patch.needsIntegration !== current.needsIntegration);
  if (needsChanged && hasOutOfScopeNeeds(next) && patch.feasibilityAcknowledged !== true) {
    next.feasibilityAcknowledged = false;
  }
  return next;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "SET_AGENT_TYPING":
      return { ...state, isAgentTyping: action.value };
    case "SET_ENGINE_READY":
      return { ...state, engineReady: action.value };
    case "SET_ENGINE_MODE":
      return { ...state, engineMode: action.mode };
    case "SET_ENGINE_CONNECTING":
      return { ...state, engineConnecting: action.value };
    case "SET_SHOW_API_CONFIG":
      return { ...state, showApiConfig: action.value };
    case "SET_ENGINE_ERROR":
      return { ...state, engineError: action.error };
    case "SET_CONVERSATION_ID":
      return { ...state, conversationId: action.id };
    case "SET_REQUIREMENTS_FROM_CHAT":
      return { ...state, requirementsFromChat: action.value };
    case "SET_AI_GATE_HINTS": {
      const nextHints = { ...state.aiGateHints, ...action.hints };
      if (
        action.hints.requirementsReady === true &&
        hasOutOfScopeNeeds(state.requirements) &&
        !state.requirements.feasibilityAcknowledged
      ) {
        nextHints.requirementsReady = state.aiGateHints.requirementsReady;
      }
      return applyGateSync({ ...state, aiGateHints: nextHints });
    }
    case "UPDATE_DISCOVERY":
      return applyGateSync({ ...state, discoveryBrief: action.brief });
    case "SET_DISCOVERY_READY":
      return { ...state, discoveryReady: true, pendingGate: "path" };
    case "SELECT_PATH":
      return { ...state, pathChoice: action.choice };
    case "CONFIRM_PATH_SELF_BUILD":
      return applyGateSync({
        ...state,
        pathChoice: "self_build",
        stage: 1,
        pendingGate: null,
      });
    case "CONFIRM_PATH_BUY":
      return {
        ...state,
        pathEndedBuy: true,
        projectCompleted: true,
        projectStatus: "completed",
        pendingGate: null,
      };
    case "SET_PATH_COMPARISON":
      return { ...state, pathComparison: action.comparison };
    case "SET_TECH_GUIDANCE":
      return {
        ...state,
        techGuidance: action.guidance,
        techRecommendation: action.recommendation ?? state.techRecommendation,
      };
    case "UPDATE_REQUIREMENTS":
      return applyGateSync({
        ...state,
        requirements: mergeRequirementsPatch(state.requirements, action.patch),
      });
    case "SET_FEASIBILITY_ACKNOWLEDGED":
      return applyGateSync({
        ...state,
        requirements: {
          ...state.requirements,
          feasibilityAcknowledged: true,
        },
      });
    case "REOPEN_REQUIREMENTS":
      return {
        ...state,
        requirementsComplete: false,
        pendingGate: null,
        aiGateHints: {
          ...state.aiGateHints,
          requirementsReady: false,
        },
      };
    case "SET_REQUIREMENTS_COMPLETE":
      return {
        ...state,
        requirementsComplete: true,
        pendingGate: "requirements",
      };
    case "CONFIRM_REQUIREMENTS":
      return {
        ...state,
        requirementsConfirmed: true,
        stage: 2,
        pendingGate: "style",
        selectedStyleId: null,
        selectedTechId: null,
      };
    case "SELECT_TECH":
      return { ...state, selectedTechId: action.techId };
    case "SELECT_STYLE":
      return { ...state, selectedStyleId: action.styleId };
    case "CONFIRM_STYLE":
      return {
        ...state,
        styleConfirmed: true,
        stage: 3,
        pendingGate: null,
        buildProgress: 0,
        buildDone: false,
        buildRunning: false,
        buildPreviewUrl: null,
        buildError: null,
        useMockPreview: false,
      };
    case "ADJUST_STYLE":
      return {
        ...state,
        styleVersion: state.styleVersion + 1,
        styleWarmth: action.warmth ?? state.styleWarmth,
        styleButtonSize: action.buttonSize ?? state.styleButtonSize,
        pendingGate: "style",
      };
    case "SET_BUILD_PROGRESS":
      return { ...state, buildProgress: action.value };
    case "SET_BUILD_RUNNING":
      return { ...state, buildRunning: action.value };
    case "SET_BUILD_CONVERSATION":
      return { ...state, buildConversationId: action.id };
    case "SET_BUILD_PROJECT_SLUG":
      return { ...state, buildProjectSlug: action.slug };
    case "SET_BUILD_PREVIEW_URL":
      return { ...state, buildPreviewUrl: action.url };
    case "SET_BUILD_ERROR":
      return { ...state, buildError: action.error };
    case "SET_USE_MOCK_PREVIEW":
      return { ...state, useMockPreview: action.value };
    case "SET_BUILD_DONE":
      return {
        ...state,
        buildDone: true,
        buildProgress: 100,
        acceptanceChecks: emptyAcceptanceChecks(state.requirements),
        pendingGate: "acceptance",
      };
    case "TOGGLE_ACCEPTANCE":
      return {
        ...state,
        acceptanceChecks: state.acceptanceChecks.map((checked, index) =>
          index === action.index ? !checked : checked,
        ),
      };
    case "SET_AWAITING_CHANGE_REQUEST":
      return { ...state, awaitingChangeRequest: action.value };
    case "REQUEST_CHANGES":
      return {
        ...state,
        buildDone: false,
        buildProgress: 0,
        buildPreviewUrl: null,
        buildError: null,
        useMockPreview: false,
        acceptanceChecks: emptyAcceptanceChecks(state.requirements),
        pendingGate: null,
      };
    case "COMPLETE_ACCEPTANCE":
      return {
        ...state,
        acceptanceCompleted: true,
        stage: 4,
        pendingGate: null,
        stagingProgress: 0,
        stagingReady: false,
        stagingRunning: false,
        stagingPreviewUrl: null,
        stagingError: null,
        goLiveChecks: [false, false, false],
      };
    case "SET_STAGING_RUNNING":
      return { ...state, stagingRunning: action.value };
    case "SET_STAGING_CONVERSATION":
      return { ...state, stagingConversationId: action.id };
    case "SET_STAGING_PREVIEW_URL":
      return { ...state, stagingPreviewUrl: action.url };
    case "SET_STAGING_ERROR":
      return { ...state, stagingError: action.error };
    case "SET_STAGING_PROGRESS":
      return { ...state, stagingProgress: action.value };
    case "SET_STAGING_READY":
      return {
        ...state,
        stagingReady: true,
        stagingProgress: 100,
        stagingRunning: false,
        pendingGate: "go_live",
      };
    case "SET_PRODUCTION_RUNNING":
      return { ...state, productionRunning: action.value };
    case "SET_PRODUCTION_CONVERSATION":
      return { ...state, productionConversationId: action.id };
    case "SET_PRODUCTION_URL":
      return { ...state, productionUrl: action.url };
    case "SET_PRODUCTION_ERROR":
      return { ...state, productionError: action.error };
    case "TOGGLE_GO_LIVE_CHECK":
      return {
        ...state,
        goLiveChecks: state.goLiveChecks.map((checked, index) =>
          index === action.index ? !checked : checked,
        ) as AppState["goLiveChecks"],
      };
    case "COMPLETE_GO_LIVE":
      return {
        ...state,
        projectCompleted: true,
        projectStatus: "completed",
        productionRunning: false,
        pendingGate: null,
      };
    case "SET_PENDING_GATE":
      return { ...state, pendingGate: action.gate };
    case "ENTER_ITERATION_MODE":
      return applyGateSync({
        ...state,
        iterationMode: true,
        projectCompleted: false,
        projectStatus: "active",
        stage: 1,
        requirementsConfirmed: false,
        requirementsComplete: false,
        selectedTechId: null,
        selectedStyleId: null,
        styleConfirmed: false,
        buildDone: false,
        buildProgress: 0,
        buildPreviewUrl: null,
        buildError: null,
        useMockPreview: false,
        acceptanceChecks: [],
        acceptanceCompleted: false,
        stagingReady: false,
        stagingPreviewUrl: null,
        stagingError: null,
        productionUrl: null,
        productionError: null,
        goLiveChecks: [false, false, false],
        pendingGate: null,
        aiGateHints: { pathReady: false, requirementsReady: false },
      });
    case "REVERT_TO_EXPLORE":
      if (state.stage > 1 || state.styleConfirmed) return state;
      return applyGateSync({
        ...state,
        stage: 0,
        discoveryReady: false,
        pendingGate: null,
        pathChoice: null,
        requirementsConfirmed: false,
        requirementsComplete: false,
      });
    case "REVERT_TO_REQUIREMENTS":
      return applyGateSync({
        ...state,
        stage: 1,
        requirementsConfirmed: false,
        requirementsComplete: false,
        selectedTechId: null,
        selectedStyleId: null,
        styleConfirmed: false,
        buildDone: false,
        buildProgress: 0,
        buildPreviewUrl: null,
        buildError: null,
        useMockPreview: false,
        acceptanceChecks: [],
        acceptanceCompleted: false,
        pendingGate: null,
        aiGateHints: {
          ...state.aiGateHints,
          requirementsReady: false,
        },
      });
    case "REVERT_TO_STYLE":
      if (state.stage < 3 && !state.styleConfirmed) return state;
      return {
        ...state,
        stage: 2,
        styleConfirmed: false,
        buildDone: false,
        buildProgress: 0,
        buildPreviewUrl: null,
        buildError: null,
        useMockPreview: false,
        acceptanceChecks: [],
        acceptanceCompleted: false,
        pendingGate: "style",
      };
    case "REVERT_TO_ACCEPTANCE":
      return {
        ...state,
        stage: 3,
        acceptanceCompleted: false,
        stagingReady: false,
        stagingPreviewUrl: null,
        stagingError: null,
        stagingProgress: 0,
        pendingGate: state.buildDone ? "acceptance" : null,
      };
    case "HYDRATE_STATE":
      return applyGateSync({
        ...state,
        ...action.snapshot,
        engineReady: state.engineReady,
        engineMode: state.engineMode,
        engineConnecting: state.engineConnecting,
        showApiConfig: state.showApiConfig,
        engineError: state.engineError,
        conversationId: state.conversationId,
        isAgentTyping: false,
        buildRunning: false,
        stagingRunning: false,
        productionRunning: false,
      });
    case "RESET_DEMO":
      return {
        ...initialState,
        showApiConfig: false,
        engineConnecting: false,
      };
    default:
      return state;
  }
}
