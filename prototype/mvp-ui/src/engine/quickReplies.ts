import type { Stage } from "../types";

export function getQuickReplies(stage: Stage): string[] {
  if (stage === 0) {
    return ["3～5 人小团队用", "数据从 Excel 导入", "希望一个月内能用"];
  }
  if (stage === 1) {
    return ["验收：能导出月度报表", "不做移动端", "两周内看到第一版"];
  }
  if (stage === 2) {
    return ["按钮再大一点", "颜色更温暖一点", "整体更简洁"];
  }
  if (stage === 3) {
    return ["表格加一列备注", "导出按钮放最上面", "整体满意"];
  }
  return [];
}
