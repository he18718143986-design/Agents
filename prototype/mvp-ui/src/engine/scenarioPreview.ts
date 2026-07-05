import type { RequirementsData } from "../types";

export interface PreviewMetric {
  label: string;
  value: string;
  tone?: "default" | "warn" | "ok";
}

export interface ScenarioPreviewModel {
  layout: "dashboard" | "form";
  headline: string;
  metrics: PreviewMetric[];
  featurePanels: { title: string; body: string }[];
  primaryAction: string;
  secondaryAction: string;
}

function corpus(requirements: RequirementsData): string {
  return [requirements.goal, ...requirements.p0Features, ...requirements.acceptance]
    .join(" ")
    .toLowerCase();
}

function isEngineeringFinance(text: string): boolean {
  return /工程|进度|财务|预算|报表|预警|项目|管控/.test(text);
}

export function buildScenarioPreview(
  requirements: RequirementsData,
): ScenarioPreviewModel {
  const text = corpus(requirements);
  const headline = requirements.goal.trim() || "项目预览";

  if (isEngineeringFinance(text)) {
    const warnings = requirements.p0Features.filter((f) => /预警/.test(f));
    return {
      layout: "dashboard",
      headline,
      metrics: [
        { label: "本月进度完成率", value: "72%", tone: "ok" },
        { label: "预算执行率", value: "89%", tone: "default" },
        {
          label: "活跃预警",
          value: warnings.length > 0 ? `${warnings.length} 条` : "0 条",
          tone: warnings.length > 0 ? "warn" : "ok",
        },
        { label: "待对账项", value: "3 笔", tone: "warn" },
      ],
      featurePanels: requirements.p0Features.slice(0, 4).map((feature) => ({
        title: feature,
        body: /报表/.test(feature)
          ? "汇总本月进度与财务数据，支持导出 Excel。"
          : /预警/.test(feature)
            ? "规则已配置：超阈值时在首页高亮提醒。"
            : /匹配|财务/.test(feature)
              ? "工程进度节点与财务科目自动关联。"
              : "模块已纳入首版范围，可在试用中操作。",
      })),
      primaryAction: text.includes("报表") ? "生成月度报表" : "查看总览",
      secondaryAction: "同步财务数据",
    };
  }

  const labels =
    requirements.p0Features.length > 0
      ? requirements.p0Features.slice(0, 6)
      : requirements.acceptance.slice(0, 4);

  return {
    layout: "form",
    headline,
    metrics: [],
    featurePanels: labels.map((label) => ({
      title: label,
      body: "首版 mock 字段，提交后在验收清单中勾选。",
    })),
    primaryAction: "提交",
    secondaryAction: "导出",
  };
}
