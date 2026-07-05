import { buildProfileNote } from "./buildCapability.js";
import type { AppState, TechChoice } from "../types.js";

/** System prompt for the workspace build agent (stage 3). */
export const BUILD_SYSTEM_PROMPT = `你是 Stagent 的制作 Agent，在独立 workspace 里实现用户确认过的软件第一版。

要求：
- 在当前工作目录创建**可静态打开**的 Web MVP（至少包含根目录 index.html）
- 用 HTML + CSS + JavaScript 实现，不依赖外部构建工具；单文件或少量文件均可
- 页面应体现用户需求中的目标与 P0 功能（可用 mock 数据，但模块/文案要对题）
- 按用户给定的技术路线与界面风格选择配色（温暖橙 / 简洁蓝灰）
- 实现完成后在回复末尾单独一行写：[BUILD_DONE]
- 不要输出 canvas-json 块

若收到 [修改请求]，在现有代码基础上迭代，仍保持 index.html 可访问。`;

const TECH_LABELS: Record<NonNullable<TechChoice>, string> = {
  web: "网页应用（浏览器打开）",
  wechat: "微信小程序（本原型用 Web 页面模拟主要界面）",
  desktop: "桌面端（本原型用可本地打开的 Web 页面模拟）",
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
    `界面风格: ${style}（warmth=${styleWarmth}，100 更暖）`,
    buildProfileNote(),
    "",
    "请在本 workspace 根目录交付可预览的 index.html 第一版。",
  );

  if (changeRequest?.trim()) {
    lines.push("", "[修改请求]", changeRequest.trim());
  }

  return lines.join("\n");
}
