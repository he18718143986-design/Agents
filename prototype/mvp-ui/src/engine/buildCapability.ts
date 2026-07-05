import type { RequirementsData } from "../types.js";

/** Current build tier. */
export type BuildProfile = "static-mvp" | "baas-mvp";

/** Future: security checks expansion for multi-tenant tiers. */
export type SecurityAcceptanceItem = {
  id: string;
  label: string;
  description: string;
};

/** Future: real hosting targets beyond workspace directory copy. */
export type DeployTarget = "workspace-copy" | "external-hosting";

export const BUILD_PROFILE: BuildProfile = "baas-mvp";

export const BUILD_CAPABILITY = {
  supports: [
    "真实数据云端保存（增删改查、刷新/换设备不丢失）",
    "登录 / 注册（多人使用同一应用）",
    "台账表格、汇总统计、预警标红、CSV 导出",
    "workspace 预览与测试/正式目录发布",
  ],
  notYet: [
    "第三方系统集成（微信/支付/短信等）",
    "复杂流程引擎（多级审批、自动化任务）",
    "微信小程序真机",
  ],
} as const;

export const PRODUCT_POSITIONING =
  "首版交付可试用、可分享、数据真实保存的应用；第三方集成与小程序正在 roadmap。";

/** Only third-party integration remains out of scope in the baas-mvp tier. */
export function hasOutOfScopeNeeds(requirements: RequirementsData): boolean {
  return requirements.needsIntegration;
}

export function feasibilityGateClear(requirements: RequirementsData): boolean {
  return !hasOutOfScopeNeeds(requirements) || requirements.feasibilityAcknowledged;
}

export function outOfScopeNeedLabels(requirements: RequirementsData): string[] {
  const labels: string[] = [];
  if (requirements.needsIntegration) labels.push("第三方系统集成");
  return labels;
}

export function buildProfileNote(): string {
  return "建造档位: baas-mvp（模板 + PocketBase 数据底座：真实保存、登录、多人使用；第三方集成暂以 mock 演示）";
}
