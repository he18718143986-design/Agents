# 决策记录（ADR）

格式：背景 → 决策 → 备选与否决理由 → 后果。状态：已采纳 / 已废弃 / 被 X 取代。

| 编号 | 决策 | 状态 |
|---|---|---|
| [ADR-001](ADR-001-openhands-engine.md) | 用 OpenHands 作为编码引擎，不自研、不 fork bolt.diy | 已采纳 |
| [ADR-002](ADR-002-demo-mode.md) | 体验模式用确定性脚本，不用 LLM | 已采纳 |
| [ADR-003](ADR-003-golden-template-pocketbase.md) | L3 数据底座用 PocketBase 黄金模板（每应用一实例） | 已采纳 |
| [ADR-004](ADR-004-declarative-modules.md) | 制作 Agent 只编辑声明式 modules.js，不自由写代码 | 已采纳 |
| [ADR-005](ADR-005-deepseek-default.md) | 中国站默认模型 DeepSeek | 已采纳 |
| [ADR-006](ADR-006-node-production-server.md) | 生产服务器用 Node（与 Vite 中间件共享网关） | 已采纳 |
| [ADR-007](ADR-007-business-sequencing.md) | 商业排序：交付生意（A）先行，生态生意（B）后置 | 已采纳 |
| [ADR-008](ADR-008-brand-naming.md) | 品牌命名、中文名与品牌哲学 | 部分采纳（名称待商标检索） |
| [ADR-009](ADR-009-sandbox-isolation.md) | 制作/部署 Agent 的每任务容器隔离 | 已采纳（设计）；待 ECS 实施 |
