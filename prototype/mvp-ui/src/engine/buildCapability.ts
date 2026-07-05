import type { RequirementsData } from "../types.js";

/** Current build tier. `baas-mvp` reserved for future Supabase/BaaS support. */
export type BuildProfile = "static-mvp" | "baas-mvp";

/** Future: security checks when BuildProfile is `baas-mvp`. */
export type SecurityAcceptanceItem = {
  id: string;
  label: string;
  description: string;
};

/** Future: real hosting targets beyond workspace directory copy. */
export type DeployTarget = "workspace-copy" | "external-hosting";

export const BUILD_PROFILE: BuildProfile = "static-mvp";

export const BUILD_CAPABILITY = {
  supports: [
    "静态网页界面",
    "mock 数据演示",
    "workspace 预览",
    "测试/正式目录发布",
  ],
  notYet: [
    "真实数据库",
    "用户登录/权限",
    "第三方 API 集成",
    "微信小程序真机",
  ],
} as const;

export const PRODUCT_POSITIONING =
  "首版交付可试用、可分享的演示应用；需要真实数据库或登录的版本正在 roadmap。";

export function hasOutOfScopeNeeds(requirements: RequirementsData): boolean {
  return (
    requirements.needsPersistence ||
    requirements.needsAuth ||
    requirements.needsIntegration
  );
}

export function feasibilityGateClear(requirements: RequirementsData): boolean {
  return !hasOutOfScopeNeeds(requirements) || requirements.feasibilityAcknowledged;
}

export function outOfScopeNeedLabels(requirements: RequirementsData): string[] {
  const labels: string[] = [];
  if (requirements.needsPersistence) labels.push("数据保存/历史记录");
  if (requirements.needsAuth) labels.push("登录/多用户");
  if (requirements.needsIntegration) labels.push("第三方系统集成");
  return labels;
}

export function buildProfileNote(): string {
  return (
    `建造档位: ${BUILD_PROFILE}（静态 HTML + mock 数据，不含真实后端/鉴权/第三方集成）`
  );
}
