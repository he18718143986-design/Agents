import type {
  PathComparison,
  PathComparisonEntry,
  RequirementsData,
  TechChoice,
  TechGuidance,
} from "../types";

export type GateHints = {
  pathReady?: boolean;
  requirementsReady?: boolean;
};

export type CanvasPatch = Partial<RequirementsData> & {
  discoveryBrief?: string;
  pathComparison?: PathComparison;
  techGuidance?: TechGuidance;
  techRecommendation?: TechChoice;
};

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((v) => String(v).trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function parsePathComparisonEntry(value: unknown): PathComparisonEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const fit = typeof raw.fit === "string" ? raw.fit.trim() : "";
  const caveat = typeof raw.caveat === "string" ? raw.caveat.trim() : "";
  if (!fit && !caveat) return undefined;
  return { fit, caveat };
}

function parsePathComparison(value: unknown): PathComparison | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const comparison: PathComparison = {};
  const saas = parsePathComparisonEntry(raw.saas);
  const lowCode = parsePathComparisonEntry(raw.low_code);
  const selfBuild = parsePathComparisonEntry(raw.self_build);
  if (saas) comparison.saas = saas;
  if (lowCode) comparison.low_code = lowCode;
  if (selfBuild) comparison.self_build = selfBuild;
  if (typeof raw.competitorNote === "string" && raw.competitorNote.trim()) {
    comparison.competitorNote = raw.competitorNote.trim();
  }
  return Object.keys(comparison).length > 0 ? comparison : undefined;
}

function parseTechGuidance(value: unknown): TechGuidance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const guidance: TechGuidance = {};
  for (const key of ["web", "wechat", "desktop"] as const) {
    const entry = raw[key];
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const summary = typeof item.summary === "string" ? item.summary.trim() : "";
    const tradeoffs =
      typeof item.tradeoffs === "string" ? item.tradeoffs.trim() : "";
    if (summary || tradeoffs) {
      guidance[key] = { summary, tradeoffs };
    }
  }
  return Object.keys(guidance).length > 0 ? guidance : undefined;
}

function parseTechRecommendation(value: unknown): TechChoice | undefined {
  if (value === "web" || value === "wechat" || value === "desktop") {
    return value;
  }
  return undefined;
}

function normalizePatch(raw: Record<string, unknown>): CanvasPatch | null {
  const patch: CanvasPatch = {};

  if (typeof raw.goal === "string" && raw.goal.trim()) patch.goal = raw.goal.trim();
  if (typeof raw.users === "string" && raw.users.trim()) patch.users = raw.users.trim();
  if (typeof raw.timeline === "string" && raw.timeline.trim()) {
    patch.timeline = raw.timeline.trim();
  }
  if (typeof raw.discoveryBrief === "string" && raw.discoveryBrief.trim()) {
    patch.discoveryBrief = raw.discoveryBrief.trim();
  }

  const needsPersistence = asBoolean(raw.needsPersistence);
  const needsAuth = asBoolean(raw.needsAuth);
  const needsIntegration = asBoolean(raw.needsIntegration);
  const feasibilityAcknowledged = asBoolean(raw.feasibilityAcknowledged);
  if (needsPersistence !== undefined) patch.needsPersistence = needsPersistence;
  if (needsAuth !== undefined) patch.needsAuth = needsAuth;
  if (needsIntegration !== undefined) patch.needsIntegration = needsIntegration;
  if (feasibilityAcknowledged !== undefined) {
    patch.feasibilityAcknowledged = feasibilityAcknowledged;
  }

  const p0 = asStringArray(raw.p0Features);
  const p1 = asStringArray(raw.p1Features);
  const acceptance = asStringArray(raw.acceptance);
  const outOfScope = asStringArray(raw.outOfScope);

  if (p0) patch.p0Features = p0;
  if (p1) patch.p1Features = p1;
  if (acceptance) patch.acceptance = acceptance;
  if (outOfScope) patch.outOfScope = outOfScope;

  const pathComparison = parsePathComparison(raw.pathComparison);
  const techGuidance = parseTechGuidance(raw.techGuidance);
  const techRecommendation = parseTechRecommendation(raw.techRecommendation);
  if (pathComparison) patch.pathComparison = pathComparison;
  if (techGuidance) patch.techGuidance = techGuidance;
  if (techRecommendation) patch.techRecommendation = techRecommendation;

  return Object.keys(patch).length > 0 ? patch : null;
}

function tryParseJson(text: string): CanvasPatch | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return normalizePatch(raw);
  } catch {
    return null;
  }
}

const PLACEHOLDER_VALUE = /暂未明确|待补充|待定|未明确|暂无/i;

function splitFeatureText(value: string): string[] {
  return value
    .split(/[、,，;；]|\n\s*[-*]\s+/)
    .map((part) => part.replace(/\*\*/g, "").trim())
    .filter((part) => part.length > 0 && !PLACEHOLDER_VALUE.test(part));
}

function readLabeledField(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|[\\n\\r])\\s*(?:[-*]\\s*)?\\*\\*${label}\\*\\*[：:]\\s*([^\\n]+)`,
      "i",
    );
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value && !PLACEHOLDER_VALUE.test(value)) {
      return value;
    }
  }
  return undefined;
}

/** Fallback when the model structured the reply in markdown but skipped canvas-json. */
export function parseRequirementsFromAgentMarkdown(text: string): CanvasPatch | null {
  const patch: CanvasPatch = {};

  const goal = readLabeledField(text, ["目标", "产品目标"]);
  if (goal) patch.goal = goal;

  const users = readLabeledField(text, ["目标用户", "用户", "使用者"]);
  if (users) patch.users = users;

  const p0Raw = readLabeledField(text, [
    "P0 功能",
    "P0功能",
    "核心功能",
    "主要功能",
  ]);
  if (p0Raw) {
    const features = splitFeatureText(p0Raw);
    if (features.length > 0) patch.p0Features = features;
  }

  const acceptanceRaw = readLabeledField(text, ["验收标准", "验收草案"]);
  if (acceptanceRaw) {
    const items = splitFeatureText(acceptanceRaw);
    if (items.length > 0) patch.acceptance = items;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/** Parse structured canvas updates emitted by the agent. */
export function parseCanvasPatchFromAgent(text: string): CanvasPatch | null {
  const fenced = text.match(/```canvas-json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1].trim());
    if (parsed) return parsed;
  }

  const comment = text.match(/<!--CANVAS_JSON-->\s*([\s\S]*?)\s*<!--\/CANVAS_JSON-->/i);
  if (comment?.[1]) {
    const parsed = tryParseJson(comment[1].trim());
    if (parsed) return parsed;
  }

  return parseRequirementsFromAgentMarkdown(text);
}

function extractCanvasJsonRaw(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```canvas-json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const comment = text.match(
    /<!--CANVAS_JSON-->\s*([\s\S]*?)\s*<!--\/CANVAS_JSON-->/i,
  );
  if (comment?.[1]) {
    try {
      return JSON.parse(comment[1].trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/** Coach readiness signals for gate buttons (requires matching canvas fields). */
export function parseGateHintsFromAgent(text: string): GateHints {
  const raw = extractCanvasJsonRaw(text);
  if (raw?.gateHints && typeof raw.gateHints === "object") {
    const hints = raw.gateHints as Record<string, unknown>;
    return {
      pathReady: hints.pathReady === true,
      requirementsReady: hints.requirementsReady === true,
    };
  }

  const hints: GateHints = {};
  if (/可以(在右侧)?(选择|确认).{0,12}(方案|路线)|可以拍板.{0,8}路线/i.test(text)) {
    hints.pathReady = true;
  }
  if (/可以确认需求|需求.{0,8}(定稿|确认)|需求文档.{0,6}确认/i.test(text)) {
    hints.requirementsReady = true;
  }
  return hints;
}

export function splitCanvasPatch(patch: CanvasPatch): {
  requirementsPatch: Partial<RequirementsData>;
  pathComparison?: PathComparison;
  techGuidance?: TechGuidance;
  techRecommendation?: TechChoice;
} {
  const {
    pathComparison,
    techGuidance,
    techRecommendation,
    discoveryBrief: _ignored,
    ...requirementsPatch
  } = patch;
  return {
    requirementsPatch,
    pathComparison,
    techGuidance,
    techRecommendation,
  };
}

/** Strip machine-readable blocks before showing chat bubbles. */
export function stripCanvasBlocksForDisplay(text: string): string {
  return text
    .replace(/```canvas-json\s*[\s\S]*?```/gi, "")
    .replace(/<!--CANVAS_JSON-->[\s\S]*?<!--\/CANVAS_JSON-->/gi, "")
    .trim();
}

/** Fallback chat text when the agent only emitted a canvas-json block. */
export function summarizeCanvasPatchForChat(patch: CanvasPatch): string {
  const lines: string[] = ["我帮你整理了需求要点："];

  if (patch.goal) {
    lines.push(`\n目标：${patch.goal}`);
  }
  if (patch.users) {
    lines.push(`\n用户：${patch.users}`);
  }
  if (patch.p0Features?.length) {
    lines.push(`\nP0 功能：\n${patch.p0Features.map((f) => `- ${f}`).join("\n")}`);
  }
  if (patch.acceptance?.length) {
    lines.push(
      `\n验收草案：\n${patch.acceptance.map((a) => `- ${a}`).join("\n")}`,
    );
  }

  lines.push("\n右侧「需求草稿」已同步更新。还缺的信息我们可以在对话里继续补。");
  return lines.join("");
}
