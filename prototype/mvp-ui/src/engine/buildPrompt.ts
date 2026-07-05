import { buildProfileNote } from "./buildCapability.js";
import type { AppState, TechChoice } from "../types.js";

/** System prompt for the workspace build agent (stage 3, baas-mvp tier). */
export const BUILD_SYSTEM_PROMPT = `你是 Stagent 的制作 Agent，在独立 workspace 里实现用户确认过的软件第一版。

本 workspace 已预置「真实数据应用模板」（先阅读 TEMPLATE_GUIDE.md）：
- 登录/注册、云端数据保存（PocketBase）、表格、汇总卡片、预警标红、CSV 导出已由模板引擎实现
- 你的核心工作是编辑 **modules.js**：把 window.STAGENT_APP 替换为符合用户需求的 title 与 modules
  - 每个 P0 功能对应一个模块；字段 type 用 text/number/date/select
  - 「预警」类需求用 warn 规则；「报表/统计」类需求用 summaries + CSV 导出
- 可编辑 custom.css 按用户风格调整 CSS 变量（文件内有示例）
- **禁止修改** app.js、base.css、config.js、index.html、lib/（会破坏数据链路）
- 编辑后用 node --check modules.js 验证语法
- 实现完成后在回复末尾单独一行写：[BUILD_DONE]
- 不要输出 canvas-json 块

若收到 [修改请求]，在现有 modules.js / custom.css 基础上增量修改，不要重建其他文件。`;

const TECH_LABELS: Record<NonNullable<TechChoice>, string> = {
  web: "网页应用（浏览器打开）",
  wechat: "微信小程序（本版本用 Web 页面模拟主要界面）",
  desktop: "桌面端（本版本用可本地打开的 Web 页面模拟）",
};

export function formatBuildSpecMessage(state: AppState, changeRequest?: string): string {
  const { requirements, selectedTechId, selectedStyleId, styleWarmth } = state;
  const tech = selectedTechId ? TECH_LABELS[selectedTechId] : "网页应用";
  const style =
    selectedStyleId === "B"
      ? "温暖亲和（米白、暖橙主色）"
      : "简洁办公（蓝灰白主色）";

  const lines = [
    "[制作任务]",
    `目标: ${requirements.goal}`,
    `用户: ${requirements.users || "未指定"}`,
    `P0 功能:\n${requirements.p0Features.map((f: string) => `- ${f}`).join("\n") || "- （见目标）"}`,
  ];

  if (requirements.acceptance.length > 0) {
    lines.push(
      `验收参考:\n${requirements.acceptance.map((a: string) => `- ${a}`).join("\n")}`,
    );
  }
  if (requirements.timeline) {
    lines.push(`时间预期: ${requirements.timeline}`);
  }

  lines.push(
    `技术路线: ${tech}`,
    `界面风格: ${style}（warmth=${styleWarmth}，100 更暖；调整 custom.css 中的 CSS 变量）`,
    buildProfileNote(),
    "",
    "请按 TEMPLATE_GUIDE.md 编辑 modules.js（必要时加 custom.css），交付真实数据版第一版。",
  );

  if (changeRequest?.trim()) {
    lines.push("", "[修改请求]", changeRequest.trim());
  }

  return lines.join("\n");
}
