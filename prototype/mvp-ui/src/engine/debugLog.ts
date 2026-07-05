import type { AppAction, AppState } from "../types";
import { gateBlockedReason } from "./gateReadiness.js";
import {
  feasibilityGateClear,
  hasOutOfScopeNeeds,
  outOfScopeNeedLabels,
} from "./buildCapability.js";

export type DebugCategory =
  | "coach"
  | "build"
  | "deploy"
  | "gate"
  | "state"
  | "persistence"
  | "session";

export type DebugEntry = {
  ts: number;
  category: DebugCategory;
  event: string;
  detail?: Record<string, unknown>;
  /** Approximate prompt/response size in characters (token proxy). */
  chars?: number;
};

const STORAGE_KEY = "stagent-debug";
const MAX_ENTRIES = 500;

type SessionStats = {
  startedAt: number;
  coachInvocations: number;
  buildInvocations: number;
  deployInvocations: number;
  coachCharsSent: number;
  buildCharsSent: number;
  deployCharsSent: number;
  userMessages: number;
};

let enabled = false;
const entries: DebugEntry[] = [];
const stats: SessionStats = {
  startedAt: Date.now(),
  coachInvocations: 0,
  buildInvocations: 0,
  deployInvocations: 0,
  coachCharsSent: 0,
  buildCharsSent: 0,
  deployCharsSent: 0,
  userMessages: 0,
};

const CATEGORY_STYLE: Record<DebugCategory, string> = {
  coach: "color:#60a5fa",
  build: "color:#f97316",
  deploy: "color:#a78bfa",
  gate: "color:#34d399",
  state: "color:#94a3b8",
  persistence: "color:#fbbf24",
  session: "color:#f472b6",
};

function readEnabledFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistEnabled(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

function notifyDebugChange(): void {
  window.dispatchEvent(new CustomEvent("stagent-debug-change"));
}

function push(entry: DebugEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  if (!enabled) return;
  const style = CATEGORY_STYLE[entry.category];
  const label = `%c[Stagent:${entry.category}]%c ${entry.event}`;
  const chars =
    entry.chars !== undefined ? ` (~${entry.chars} chars)` : "";
  if (entry.detail) {
    console.groupCollapsed(`${label}${chars}`, style, "color:inherit");
    console.log(entry.detail);
    console.groupEnd();
  } else {
    console.log(`${label}${chars}`, style, "color:inherit");
  }
}

export function initDebugLog(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") {
    enabled = true;
    persistEnabled(true);
  } else if (params.get("debug") === "0") {
    enabled = false;
    persistEnabled(false);
  } else if (import.meta.env.DEV) {
    // Local dev (npm run dev / prototype/dev.sh): debug on unless explicitly off.
    enabled = localStorage.getItem(STORAGE_KEY) !== "0";
  } else {
    enabled = readEnabledFromStorage();
  }

  if (enabled) {
    console.info(
      "%c[Stagent:session]%c Debug logging ON" +
        (import.meta.env.DEV ? " (dev default)" : "") +
        ". TopBar → 导出日志，或 __stagentDebug.download()",
      CATEGORY_STYLE.session,
      "color:inherit",
    );
    notifyDebugChange();
  }

  const api = {
    enable: () => {
      enabled = true;
      persistEnabled(true);
      log("session", "debug.enabled");
      notifyDebugChange();
    },
    disable: () => {
      enabled = false;
      persistEnabled(false);
      console.info("[Stagent] Debug logging OFF");
      notifyDebugChange();
    },
    isEnabled: () => enabled,
    export: () => exportDebugLog(),
    download: () => downloadDebugLog(),
    dump: () => {
      console.table(entries.slice(-30).map((e) => ({
        time: new Date(e.ts).toISOString(),
        category: e.category,
        event: e.event,
        chars: e.chars ?? "",
      })));
      console.log("stats", { ...stats });
      return exportDebugLog();
    },
    stats: () => ({ ...stats }),
    clear: () => {
      entries.length = 0;
      Object.assign(stats, {
        startedAt: Date.now(),
        coachInvocations: 0,
        buildInvocations: 0,
        deployInvocations: 0,
        coachCharsSent: 0,
        buildCharsSent: 0,
        deployCharsSent: 0,
        userMessages: 0,
      });
      log("session", "debug.cleared");
    },
  };

  (
    window as Window & { __stagentDebug?: typeof api }
  ).__stagentDebug = api;
}

export function isDebugEnabled(): boolean {
  return enabled;
}

export function log(
  category: DebugCategory,
  event: string,
  detail?: Record<string, unknown>,
  chars?: number,
): void {
  if (!enabled && category !== "session") {
    // Always buffer entries for later export even when disabled mid-session
  }
  push({ ts: Date.now(), category, event, detail, chars });
}

export function trackCoachSend(payload: string): void {
  stats.coachInvocations += 1;
  stats.coachCharsSent += payload.length;
  log(
    "coach",
    "llm.send",
    {
      invocation: stats.coachInvocations,
      stage: extractStageFromPayload(payload),
      payloadPreview: preview(payload, 400),
    },
    payload.length,
  );
}

export function trackBuildSend(spec: string, slug: string, isRevision: boolean): void {
  if (!isRevision) {
    stats.buildInvocations += 1;
  }
  stats.buildCharsSent += spec.length;
  log(
    "build",
    isRevision ? "llm.revision" : "llm.start",
    {
      invocation: stats.buildInvocations,
      slug,
      specPreview: preview(spec, 300),
    },
    spec.length,
  );
}

export function trackDeploySend(
  spec: string,
  phase: string,
  slug: string,
): void {
  stats.deployInvocations += 1;
  stats.deployCharsSent += spec.length;
  log(
    "deploy",
    "llm.start",
    { invocation: stats.deployInvocations, phase, slug, specPreview: preview(spec, 200) },
    spec.length,
  );
}

export function trackUserMessage(text: string, stage: number): void {
  stats.userMessages += 1;
  log("coach", "user.message", { stage, text: preview(text, 200) }, text.length);
}

export function logCoachResponse(
  rawText: string,
  parsed: {
    patchKeys: string[];
    gateHints: Record<string, boolean>;
    hasCanvasJson: boolean;
  },
): void {
  log(
    "coach",
    "llm.response",
    {
      hasCanvasJson: parsed.hasCanvasJson,
      patchKeys: parsed.patchKeys,
      gateHints: parsed.gateHints,
      rawPreview: preview(rawText, 500),
    },
    rawText.length,
  );
}

export function logGateDiagnostics(state: AppState, trigger?: string): void {
  const blocked = gateBlockedReason(state.stage, state);
  log("gate", trigger ?? "gate.snapshot", {
    stage: state.stage,
    pendingGate: state.pendingGate,
    discoveryReady: state.discoveryReady,
    requirementsComplete: state.requirementsComplete,
    aiGateHints: state.aiGateHints,
    feasibility: {
      needsPersistence: state.requirements.needsPersistence,
      needsAuth: state.requirements.needsAuth,
      needsIntegration: state.requirements.needsIntegration,
      acknowledged: state.requirements.feasibilityAcknowledged,
      gateClear: feasibilityGateClear(state.requirements),
      outOfScopeLabels: hasOutOfScopeNeeds(state.requirements)
        ? outOfScopeNeedLabels(state.requirements)
        : [],
    },
    blockedReason: blocked,
    iterationMode: state.iterationMode,
    projectCompleted: state.projectCompleted,
  });
}

export function logStateAction(action: AppAction, snapshot?: Partial<AppState>): void {
  const interesting = [
    "CONFIRM_PATH_SELF_BUILD",
    "CONFIRM_PATH_BUY",
    "CONFIRM_REQUIREMENTS",
    "CONFIRM_STYLE",
    "COMPLETE_ACCEPTANCE",
    "COMPLETE_GO_LIVE",
    "ENTER_ITERATION_MODE",
    "REVERT_TO_EXPLORE",
    "REVERT_TO_REQUIREMENTS",
    "REVERT_TO_STYLE",
    "REVERT_TO_ACCEPTANCE",
    "SET_FEASIBILITY_ACKNOWLEDGED",
    "HYDRATE_STATE",
    "RESET_DEMO",
  ];
  if (!interesting.includes(action.type)) return;
  log("state", action.type, snapshot ?? { action });
}

export function logPersistence(event: string, detail: Record<string, unknown>): void {
  log("persistence", event, detail);
}

export function exportDebugLog(): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    stats: { ...stats },
    tokenProxy: {
      note: "chars 为字符数近似值，真实 token 以模型计费为准（中文约 1–2 char/token）",
      coach: stats.coachCharsSent,
      build: stats.buildCharsSent,
      deploy: stats.deployCharsSent,
      total: stats.coachCharsSent + stats.buildCharsSent + stats.deployCharsSent,
    },
    entries: [...entries],
  };
  const json = JSON.stringify(payload, null, 2);
  if (enabled) {
    console.info(
      `%c[Stagent:session]%c Exported ${entries.length} entries`,
      CATEGORY_STYLE.session,
      "color:inherit",
    );
  }
  return json;
}

export function downloadDebugLog(filename?: string): void {
  const json = exportDebugLog();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ?? `stagent-debug-${new Date().toISOString().slice(0, 19)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function preview(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
}

function extractStageFromPayload(payload: string): number | null {
  const match = payload.match(/当前阶段[：:]\s*(\d)/);
  if (match) return Number(match[1]);
  return null;
}
