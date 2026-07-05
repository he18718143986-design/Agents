import type { StyleOption } from "./types";

export const TECH_OPTIONS = [
  {
    id: "web" as const,
    name: "网页应用",
    summary: "手机电脑都能用，后续扩展性好",
    cost: "维护成本：中",
    recommended: true,
  },
  {
    id: "wechat" as const,
    name: "微信小程序",
    summary: "员工在微信里打开，上手快",
    cost: "维护成本：中",
  },
  {
    id: "desktop" as const,
    name: "本地小工具",
    summary: "仅行政电脑使用，上线最快",
    cost: "维护成本：低",
  },
];

export const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "A",
    name: "简洁办公",
    description: "蓝灰白配色，干净利落，适合日常办公场景",
    colors: ["#2563eb", "#f8fafc", "#0f172a"],
  },
  {
    id: "B",
    name: "温暖亲和",
    description: "米白与暖橙，按钮更醒目，适合非技术同事使用",
    colors: ["#ea580c", "#fff7ed", "#431407"],
    recommended: true,
  },
];

export function detectStyleFeedback(text: string): {
  warmth?: number;
  buttonSize?: number;
  reply: string;
} | null {
  let warmth: number | undefined;
  let buttonSize: number | undefined;
  const parts: string[] = [];

  if (/暖|温暖|橙|鲜艳/.test(text)) {
    warmth = 80;
    parts.push("已把整体色调调暖");
  }
  if (/冷|蓝|素/.test(text)) {
    warmth = 25;
    parts.push("已调整为更冷静的配色");
  }
  if (/按钮.*大|大一点|更大/.test(text)) {
    buttonSize = 85;
    parts.push("已加大主按钮尺寸");
  }
  if (/按钮.*小|简约/.test(text)) {
    buttonSize = 35;
    parts.push("已缩小按钮，让页面更简约");
  }

  if (parts.length === 0) return null;

  return {
    warmth,
    buttonSize,
    reply: `好的，${parts.join("，")}。请查看右侧更新后的风格预览（v${Date.now() % 9 + 2}）。满意的话请点击「确认风格，开始制作」。`,
  };
}

