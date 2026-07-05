import type { AppState, PersistedWorkspaceSnapshot } from "../types";
import { initialRequirements, initialState } from "../store";
import { logPersistence } from "./debugLog.js";

export const SNAPSHOT_VERSION = 1;
const SNAPSHOT_PREFIX = "mvp-ui-snapshot-v1:";
const MAX_MESSAGES = 200;

function snapshotKey(projectId: string): string {
  return `${SNAPSHOT_PREFIX}${projectId}`;
}

export function extractPersistableSnapshot(state: AppState): PersistedWorkspaceSnapshot {
  const messages =
    state.messages.length > MAX_MESSAGES
      ? state.messages.slice(-MAX_MESSAGES)
      : state.messages;

  return {
    stage: state.stage,
    messages,
    discoveryBrief: state.discoveryBrief,
    discoveryReady: state.discoveryReady,
    pathChoice: state.pathChoice,
    pathEndedBuy: state.pathEndedBuy,
    pathComparison: state.pathComparison,
    requirements: state.requirements,
    requirementsComplete: state.requirementsComplete,
    requirementsConfirmed: state.requirementsConfirmed,
    selectedTechId: state.selectedTechId,
    selectedStyleId: state.selectedStyleId,
    styleVersion: state.styleVersion,
    styleConfirmed: state.styleConfirmed,
    techGuidance: state.techGuidance,
    techRecommendation: state.techRecommendation,
    buildProgress: state.buildProgress,
    buildDone: state.buildDone,
    buildProjectSlug: state.buildProjectSlug,
    buildPreviewUrl: state.buildPreviewUrl,
    buildError: state.buildError,
    useMockPreview: state.useMockPreview,
    acceptanceChecks: state.acceptanceChecks,
    acceptanceCompleted: state.acceptanceCompleted,
    stagingProgress: state.stagingProgress,
    stagingReady: state.stagingReady,
    stagingPreviewUrl: state.stagingPreviewUrl,
    stagingError: state.stagingError,
    productionUrl: state.productionUrl,
    productionError: state.productionError,
    goLiveChecks: state.goLiveChecks,
    projectCompleted: state.projectCompleted,
    projectStatus: state.projectStatus,
    iterationMode: state.iterationMode,
    pendingGate: state.pendingGate,
    requirementsFromChat: state.requirementsFromChat,
    aiGateHints: state.aiGateHints,
    styleWarmth: state.styleWarmth,
    styleButtonSize: state.styleButtonSize,
  };
}

export function saveProjectSnapshot(projectId: string, state: AppState): void {
  const payload = {
    version: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    snapshot: extractPersistableSnapshot(state),
  };
  try {
    localStorage.setItem(snapshotKey(projectId), JSON.stringify(payload));
    logPersistence("snapshot.saved", {
      projectId,
      stage: state.stage,
      messageCount: state.messages.length,
      buildProjectSlug: state.buildProjectSlug,
    });
  } catch {
    // ignore quota errors in prototype
  }
}

function normalizeRequirements(
  raw: Partial<AppState["requirements"]> | undefined,
): AppState["requirements"] {
  if (!raw) return { ...initialRequirements };
  return {
    ...initialRequirements,
    ...raw,
    p0Features: raw.p0Features ?? [],
    p1Features: raw.p1Features ?? [],
    acceptance: raw.acceptance ?? [],
    outOfScope: raw.outOfScope ?? [],
    needsPersistence: raw.needsPersistence ?? false,
    needsAuth: raw.needsAuth ?? false,
    needsIntegration: raw.needsIntegration ?? false,
    feasibilityAcknowledged: raw.feasibilityAcknowledged ?? false,
  };
}

export function loadProjectSnapshot(
  projectId: string,
): PersistedWorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: number;
      snapshot?: Partial<PersistedWorkspaceSnapshot>;
    };
    if (!parsed.snapshot) return null;
    const snap = parsed.snapshot;
    const loaded = {
      ...extractPersistableSnapshot(initialState),
      ...snap,
      requirements: normalizeRequirements(snap.requirements),
      messages: snap.messages ?? [],
      acceptanceChecks: snap.acceptanceChecks ?? [],
      goLiveChecks: snap.goLiveChecks ?? [false, false, false],
      aiGateHints: snap.aiGateHints ?? { pathReady: false, requirementsReady: false },
    };
    logPersistence("snapshot.loaded", {
      projectId,
      stage: loaded.stage,
      messageCount: loaded.messages.length,
      buildProjectSlug: loaded.buildProjectSlug,
    });
    return loaded;
  } catch {
    return null;
  }
}

export function deleteProjectSnapshot(projectId: string): void {
  localStorage.removeItem(snapshotKey(projectId));
}
