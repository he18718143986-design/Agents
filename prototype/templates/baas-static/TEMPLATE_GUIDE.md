# 模板使用指南（制作 Agent 必读）

本 workspace 已预置「真实数据应用模板」：登录/注册、云端数据保存（PocketBase）、表格、汇总卡片、预警标红、CSV 导出全部由引擎实现。

## 你的任务

1. **只需编辑 `modules.js`**：把 `window.STAGENT_APP` 替换为符合用户需求的 title 和 modules（格式见该文件顶部注释）。模块拆分要对应用户的 P0 功能。
2. **可选编辑 `custom.css`**：按用户选择的界面风格调整 CSS 变量（文件内有示例）。
3. **禁止修改**：`app.js`、`base.css`、`config.js`、`index.html`、`lib/`。这些由平台维护，改动会破坏数据链路。

## 设计建议

- 每个 P0 功能对应一个模块；字段 5 个以内，优先 text/number/date，枚举值用 select
- 涉及"预警"的需求用 warn 规则表达（如 进度% lt 100、库存 lt 安全值）
- 涉及"报表/统计"的需求用 summaries + CSV 导出表达
- title 用用户需求里的软件名称或概括

## 完成标准

- `modules.js` 语法正确（可用 node --check 验证）
- 回复末尾单独一行输出：[BUILD_DONE]
