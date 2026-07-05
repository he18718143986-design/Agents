import type { AppState } from "../types.js";

export type DeployPhase = "staging" | "production";

export const STAGING_DEPLOY_SYSTEM_PROMPT = `你是 Stagent 的部署 Agent，负责把已验收通过的应用发布到**测试环境**。

要求：
- 工作区根目录应已有 index.html（制作 Agent 产出）；将其及全部依赖资源（app.js、modules.js、config.js、base.css、custom.css、lib/ 目录）复制到 staging/ 目录
- 编写 deploy/staging.json：{"previewPath":"staging/index.html","notes":"..."} 
- 编写 deploy/STAGING_README.md：说明如何自测、回滚
- 完成后在回复末尾单独一行写：[STAGING_READY]
- 不要输出 canvas-json`;

export const PRODUCTION_DEPLOY_SYSTEM_PROMPT = `你是 Stagent 的部署 Agent，负责将测试通过的应用发布到**正式环境**。

要求：
- 从 staging/ 或根目录复制 index.html 及全部依赖资源（app.js、modules.js、config.js、base.css、custom.css、lib/ 目录）到 production/ 目录（保留可静态访问）
- 编写 deploy/production.json：{"previewPath":"production/index.html","notes":"..."}
- 编写 deploy/PRODUCTION_README.md：交付物清单与上线说明
- 完成后在回复末尾单独一行写：[DEPLOY_DONE]
- 不要输出 canvas-json`;

export function formatStagingDeploySpec(state: AppState): string {
  const lines = [
    "[测试环境部署任务]",
    `项目: ${state.requirements.goal || "未命名项目"}`,
    "用户已在阶段 3 验收通过，请部署到测试环境。",
  ];
  if (state.buildPreviewUrl) {
    lines.push(`制作预览: ${state.buildPreviewUrl}`);
  }
  lines.push(
    "",
    "请检查 workspace 中的 index.html，复制到 staging/ 并写入 deploy/staging.json。",
    "目标：右侧可通过 workspace 静态服务访问 staging/index.html。",
  );
  return lines.join("\n");
}

export function formatProductionDeploySpec(state: AppState): string {
  const lines = [
    "[正式环境部署任务]",
    `项目: ${state.requirements.goal || "未命名项目"}`,
    "用户已完成上线检查清单，请发布到正式环境。",
  ];
  if (state.stagingPreviewUrl) {
    lines.push(`测试环境: ${state.stagingPreviewUrl}`);
  }
  lines.push(
    "",
    "请将应用复制到 production/ 并写入 deploy/production.json。",
    "目标：右侧可通过 workspace 静态服务访问 production/index.html。",
  );
  return lines.join("\n");
}

export function deploySystemPrompt(phase: DeployPhase): string {
  return phase === "staging"
    ? STAGING_DEPLOY_SYSTEM_PROMPT
    : PRODUCTION_DEPLOY_SYSTEM_PROMPT;
}

export function formatDeploySpec(state: AppState, phase: DeployPhase): string {
  return phase === "staging"
    ? formatStagingDeploySpec(state)
    : formatProductionDeploySpec(state);
}
