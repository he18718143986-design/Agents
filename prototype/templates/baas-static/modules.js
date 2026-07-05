/**
 * 业务模块声明 — 这是制作 Agent 主要编辑的文件。
 *
 * 每个模块 = 一个页签，包含表单、表格、汇总卡片、预警规则、CSV 导出（引擎自动实现）。
 * 字段 type 可选: "text" | "number" | "date" | "select"（select 需提供 options 数组）。
 * summaries 可选，op: "count" | "sum" | "avg"（sum/avg 需指定 number 字段的 key）。
 * warn 可选：{ field, op: "lt"|"gt", value, message } — 命中的记录整行标红并计入预警卡片。
 */
window.STAGENT_APP = {
  title: "示例应用（待替换）",
  modules: [
    {
      id: "example",
      title: "示例台账",
      description: "这是模板自带的示例模块，制作时会被替换为真实业务模块。",
      fields: [
        { key: "name", label: "名称", type: "text", required: true },
        { key: "amount", label: "金额", type: "number" },
        { key: "date", label: "日期", type: "date" },
        { key: "note", label: "备注", type: "text" },
      ],
      summaries: [
        { label: "记录总数", op: "count" },
        { label: "金额合计", op: "sum", field: "amount" },
      ],
      warn: { field: "amount", op: "gt", value: 10000, message: "大额记录" },
    },
  ],
};
