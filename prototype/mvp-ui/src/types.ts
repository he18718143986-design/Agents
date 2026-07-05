export type Stage = 0 | 1 | 2 | 3 | 4;

export type GateType =
  | "path"
  | "requirements"
  | "style"
  | "acceptance"
  | "go_live"
  | null;

export type PathChoice = "self_build" | "saas" | "low_code" | null;

export type TechChoice = "web" | "wechat" | "desktop" | null;

export type ProjectStatus = "active" | "completed";

export type MessageRole = "agent" | "user";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface RequirementsData {
  goal: string;
  users: string;
  p0Features: string[];
  p1Features: string[];
  acceptance: string[];
  outOfScope: string[];
  timeline: string;
  needsPersistence: boolean;
  needsAuth: boolean;
  needsIntegration: boolean;
  feasibilityAcknowledged: boolean;
}

export interface PathComparisonEntry {
  fit: string;
  caveat: string;
}

export interface PathComparison {
  saas?: PathComparisonEntry;
  low_code?: PathComparisonEntry;
  self_build?: PathComparisonEntry;
  competitorNote?: string;
}

export interface TechGuidanceEntry {
  summary: string;
  tradeoffs: string;
}

export type TechGuidance = Partial<
  Record<NonNullable<TechChoice>, TechGuidanceEntry>
>;

export interface StyleOption {
  id: "A" | "B";
  name: string;
  description: string;
  colors: string[];
  recommended?: boolean;
}

export interface AppState {
  stage: Stage;
  messages: ChatMessage[];
  discoveryBrief: string;
  discoveryReady: boolean;
  pathChoice: PathChoice;
  pathEndedBuy: boolean;
  pathComparison: PathComparison | null;
  requirements: RequirementsData;
  requirementsComplete: boolean;
  requirementsConfirmed: boolean;
  selectedTechId: TechChoice;
  selectedStyleId: "A" | "B" | null;
  styleVersion: number;
  styleConfirmed: boolean;
  techGuidance: TechGuidance | null;
  techRecommendation: TechChoice;
  buildProgress: number;
  buildDone: boolean;
  buildRunning: boolean;
  buildConversationId: string | null;
  buildProjectSlug: string | null;
  buildPreviewUrl: string | null;
  buildError: string | null;
  useMockPreview: boolean;
  acceptanceChecks: [boolean, boolean, boolean];
  acceptanceCompleted: boolean;
  stagingProgress: number;
  stagingReady: boolean;
  stagingRunning: boolean;
  stagingConversationId: string | null;
  stagingPreviewUrl: string | null;
  stagingError: string | null;
  productionRunning: boolean;
  productionConversationId: string | null;
  productionUrl: string | null;
  productionError: string | null;
  goLiveChecks: [boolean, boolean, boolean];
  projectCompleted: boolean;
  projectStatus: ProjectStatus;
  iterationMode: boolean;
  pendingGate: GateType;
  isAgentTyping: boolean;
  engineReady: boolean;
  engineConnecting: boolean;
  showApiConfig: boolean;
  engineError: string | null;
  conversationId: string | null;
  requirementsFromChat: boolean;
  aiGateHints: {
    pathReady: boolean;
    requirementsReady: boolean;
  };
  styleWarmth: number;
  styleButtonSize: number;
}

export type AppAction =
  | { type: "ADD_MESSAGE"; message: ChatMessage }
  | { type: "SET_AGENT_TYPING"; value: boolean }
  | { type: "SET_ENGINE_READY"; value: boolean }
  | { type: "SET_ENGINE_CONNECTING"; value: boolean }
  | { type: "SET_SHOW_API_CONFIG"; value: boolean }
  | { type: "SET_ENGINE_ERROR"; error: string | null }
  | { type: "SET_CONVERSATION_ID"; id: string | null }
  | { type: "SET_REQUIREMENTS_FROM_CHAT"; value: boolean }
  | { type: "SET_AI_GATE_HINTS"; hints: Partial<AppState["aiGateHints"]> }
  | { type: "UPDATE_DISCOVERY"; brief: string }
  | { type: "SET_DISCOVERY_READY" }
  | { type: "SELECT_PATH"; choice: PathChoice }
  | { type: "CONFIRM_PATH_SELF_BUILD" }
  | { type: "CONFIRM_PATH_BUY" }
  | { type: "SET_PATH_COMPARISON"; comparison: PathComparison | null }
  | { type: "SET_TECH_GUIDANCE"; guidance: TechGuidance | null; recommendation?: TechChoice }
  | { type: "UPDATE_REQUIREMENTS"; patch: Partial<RequirementsData> }
  | { type: "SET_FEASIBILITY_ACKNOWLEDGED" }
  | { type: "REOPEN_REQUIREMENTS" }
  | { type: "SET_REQUIREMENTS_COMPLETE" }
  | { type: "CONFIRM_REQUIREMENTS" }
  | { type: "SELECT_TECH"; techId: TechChoice }
  | { type: "SELECT_STYLE"; styleId: "A" | "B" }
  | { type: "CONFIRM_STYLE" }
  | { type: "ADJUST_STYLE"; warmth?: number; buttonSize?: number }
  | { type: "SET_BUILD_PROGRESS"; value: number }
  | { type: "SET_BUILD_RUNNING"; value: boolean }
  | { type: "SET_BUILD_CONVERSATION"; id: string | null }
  | { type: "SET_BUILD_PROJECT_SLUG"; slug: string | null }
  | { type: "SET_BUILD_PREVIEW_URL"; url: string | null }
  | { type: "SET_BUILD_ERROR"; error: string | null }
  | { type: "SET_USE_MOCK_PREVIEW"; value: boolean }
  | { type: "SET_BUILD_DONE" }
  | { type: "TOGGLE_ACCEPTANCE"; index: number }
  | { type: "REQUEST_CHANGES" }
  | { type: "COMPLETE_ACCEPTANCE" }
  | { type: "SET_STAGING_RUNNING"; value: boolean }
  | { type: "SET_STAGING_CONVERSATION"; id: string | null }
  | { type: "SET_STAGING_PREVIEW_URL"; url: string | null }
  | { type: "SET_STAGING_ERROR"; error: string | null }
  | { type: "SET_STAGING_PROGRESS"; value: number }
  | { type: "SET_STAGING_READY" }
  | { type: "SET_PRODUCTION_RUNNING"; value: boolean }
  | { type: "SET_PRODUCTION_CONVERSATION"; id: string | null }
  | { type: "SET_PRODUCTION_URL"; url: string | null }
  | { type: "SET_PRODUCTION_ERROR"; error: string | null }
  | { type: "COMPLETE_GO_LIVE" }
  | { type: "TOGGLE_GO_LIVE_CHECK"; index: number }
  | { type: "SET_PENDING_GATE"; gate: GateType }
  | { type: "ENTER_ITERATION_MODE" }
  | { type: "REVERT_TO_EXPLORE" }
  | { type: "REVERT_TO_REQUIREMENTS" }
  | { type: "REVERT_TO_STYLE" }
  | { type: "REVERT_TO_ACCEPTANCE" }
  | { type: "HYDRATE_STATE"; snapshot: Partial<AppState> }
  | { type: "RESET_DEMO" };

/** Fields persisted per project workspace (excludes live engine connection). */
export type PersistedWorkspaceSnapshot = Pick<
  AppState,
  | "stage"
  | "messages"
  | "discoveryBrief"
  | "discoveryReady"
  | "pathChoice"
  | "pathEndedBuy"
  | "pathComparison"
  | "requirements"
  | "requirementsComplete"
  | "requirementsConfirmed"
  | "selectedTechId"
  | "selectedStyleId"
  | "styleVersion"
  | "styleConfirmed"
  | "techGuidance"
  | "techRecommendation"
  | "buildProgress"
  | "buildDone"
  | "buildProjectSlug"
  | "buildPreviewUrl"
  | "buildError"
  | "useMockPreview"
  | "acceptanceChecks"
  | "acceptanceCompleted"
  | "stagingProgress"
  | "stagingReady"
  | "stagingPreviewUrl"
  | "stagingError"
  | "productionUrl"
  | "productionError"
  | "goLiveChecks"
  | "projectCompleted"
  | "projectStatus"
  | "iterationMode"
  | "pendingGate"
  | "requirementsFromChat"
  | "aiGateHints"
  | "styleWarmth"
  | "styleButtonSize"
>;
