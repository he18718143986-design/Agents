import type { AppState } from "../types";

const STAGE_NAMES: Record<AppState["stage"], string> = {
  0: "探索（值不值得做）",
  1: "需求整理",
  2: "技术路线与风格",
  3: "制作与验收",
  4: "测试与上线",
};

/** Stage metadata injected into each engine message (canvas stays mock in phase A). */
export function buildStageContext(state: AppState): string {
  const lines = [
    "[阶段上下文]",
    `当前 MVP 阶段: ${state.stage}（${STAGE_NAMES[state.stage]}）`,
  ];

  if (state.discoveryBrief) {
    lines.push(`探索摘要: ${state.discoveryBrief}`);
  }
  if (state.discoveryReady) {
    lines.push("探索已完成，等待用户在右侧选择路线。");
  }
  if (state.pathChoice) {
    lines.push(`已选路线: ${state.pathChoice}`);
  }
  if (state.stage >= 1 && state.requirements.goal) {
    lines.push(`需求目标: ${state.requirements.goal}`);
  }
  if (state.requirementsComplete) {
    lines.push("需求文档已在右侧整理完成，等待用户确认。");
  }
  if (state.selectedTechId) {
    lines.push(`技术路线: ${state.selectedTechId}`);
  }
  if (state.selectedStyleId) {
    lines.push(`界面风格: ${state.selectedStyleId}`);
  }
  if (state.buildDone) {
    lines.push(
      state.buildPreviewUrl
        ? "右侧 workspace 预览已就绪，用户可验收。"
        : "右侧展示场景 mock 或 workspace 预览，用户可验收。",
    );
  }
  if (state.buildRunning) {
    lines.push("workspace 制作 Agent 正在运行。");
  }
  if (state.stagingRunning) {
    lines.push("测试环境部署 Agent 正在运行。");
  }
  if (state.stagingReady && state.stagingPreviewUrl) {
    lines.push("测试环境 workspace 预览已就绪。");
  }
  if (state.productionRunning) {
    lines.push("正式环境部署 Agent 正在运行。");
  }
  if (state.projectCompleted && state.productionUrl) {
    lines.push("正式环境已上线，用户可查看 production 预览。");
  }

  lines.push(
    "说明：用户描述想法后，右侧会展示需求草稿与方案对比；「你的情况」仅记录用户原话。",
  );
  lines.push(
    "拍板门禁：path 需 goal+p0Features+探索摘要且 gateHints.pathReady 为 true；requirements 需全部核心字段且 gateHints.requirementsReady 为 true。",
  );

  return lines.join("\n");
}
