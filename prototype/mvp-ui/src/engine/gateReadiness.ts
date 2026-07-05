import type { AppState, RequirementsData } from "../types.js";
import { log as debugLog } from "./debugLog.js";
import {
  feasibilityGateClear,
  hasOutOfScopeNeeds,
  outOfScopeNeedLabels,
} from "./buildCapability.js";
import type { GateHints } from "./parseCanvasPatch";

export function fieldsReadyForPath(
  requirements: RequirementsData,
  discoveryBrief: string,
): boolean {
  return (
    requirements.goal.trim().length > 0 &&
    requirements.p0Features.length > 0 &&
    discoveryBrief.trim().length > 0
  );
}

export function fieldsReadyForRequirements(requirements: RequirementsData): boolean {
  return (
    requirements.goal.trim().length > 0 &&
    requirements.users.trim().length > 0 &&
    requirements.p0Features.length > 0 &&
    requirements.acceptance.length > 0 &&
    requirements.timeline.trim().length > 0 &&
    feasibilityGateClear(requirements)
  );
}

export function mergeGateHints(
  current: AppState["aiGateHints"],
  incoming: GateHints,
  requirements: RequirementsData,
): AppState["aiGateHints"] {
  const requirementsReady =
    incoming.requirementsReady === true &&
    fieldsReadyForRequirements(requirements);

  return {
    pathReady: incoming.pathReady === true || current.pathReady,
    requirementsReady: requirementsReady || current.requirementsReady,
  };
}

/** Gate visibility = canvas fields satisfied AND the coach signaled readiness. */
export function applyGateSync(state: AppState): AppState {
  let next = state;
  const beforeGate = {
    discoveryReady: next.discoveryReady,
    requirementsComplete: next.requirementsComplete,
    pendingGate: next.pendingGate,
  };

  if (
    next.stage === 0 &&
    !next.discoveryReady &&
    !next.pathEndedBuy &&
    !next.iterationMode &&
    fieldsReadyForPath(next.requirements, next.discoveryBrief) &&
    next.aiGateHints.pathReady
  ) {
    next = { ...next, discoveryReady: true, pendingGate: "path" };
  }

  if (
    next.stage === 1 &&
    !next.requirementsComplete &&
    !next.requirementsConfirmed &&
    fieldsReadyForRequirements(next.requirements) &&
    next.aiGateHints.requirementsReady
  ) {
    next = { ...next, requirementsComplete: true, pendingGate: "requirements" };
  }

  if (
    beforeGate.discoveryReady !== next.discoveryReady ||
    beforeGate.requirementsComplete !== next.requirementsComplete ||
    beforeGate.pendingGate !== next.pendingGate
  ) {
    debugLog("gate", "gate.transition", {
      from: beforeGate,
      to: {
        discoveryReady: next.discoveryReady,
        requirementsComplete: next.requirementsComplete,
        pendingGate: next.pendingGate,
      },
      stage: next.stage,
      blockedReason: gateBlockedReason(next.stage, next),
    });
  }

  return next;
}

export function missingRequirementFields(requirements: RequirementsData): string[] {
  const missing: string[] = [];
  if (!requirements.goal.trim()) missing.push("目标");
  if (!requirements.users.trim()) missing.push("用户");
  if (requirements.p0Features.length === 0) missing.push("P0 功能");
  if (requirements.acceptance.length === 0) missing.push("验收标准");
  if (!requirements.timeline.trim()) missing.push("时间预期");
  return missing;
}

export function gateBlockedReason(
  stage: AppState["stage"],
  state: Pick<
    AppState,
    | "discoveryReady"
    | "requirementsComplete"
    | "requirements"
    | "discoveryBrief"
    | "aiGateHints"
  >,
): string | null {
  if (stage === 0 && !state.discoveryReady) {
    if (!fieldsReadyForPath(state.requirements, state.discoveryBrief)) {
      return "右侧需求草稿需至少有目标与 P0 功能";
    }
    if (!state.aiGateHints.pathReady) {
      return "Agent 认为信息尚不足，暂不能选路线";
    }
  }
  if (stage === 1 && !state.requirementsComplete) {
    const missing = missingRequirementFields(state.requirements);
    if (missing.length > 0) {
      return `需求草稿还缺：${missing.join("、")}`;
    }
    if (hasOutOfScopeNeeds(state.requirements) && !state.requirements.feasibilityAcknowledged) {
      const needs = outOfScopeNeedLabels(state.requirements);
      return `需确认：${needs.join("、")} 首版将以 mock 演示`;
    }
    if (!state.aiGateHints.requirementsReady) {
      return "Agent 认为需求尚待补充，暂不能确认";
    }
  }
  return null;
}
