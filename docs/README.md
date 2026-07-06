# Stagent 项目文档

> 文档即决策记录。每份文档标注状态与最后更新日期；过期文档修订而非删除。

## 目录

### 01 战略与决策（Why）

| 文档 | 回答什么 |
|------|----------|
| [商业战略与单位经济](01-strategy/business-strategy.md) | 为谁、怎么赚钱、阶段排序 |
| [品牌叙事与品牌语系统](01-strategy/brand.md) | 名字的含义、价值主张、品牌故事、slogan 系统 |
| [产品路线图](01-strategy/roadmap.md) | 现在做什么、不做什么、何时做 |
| [PRD：P1 内测版（范围冻结）](01-strategy/prd-p1.md) | 功能、验收标准、out of scope |
| [决策记录 ADR](01-strategy/adr/) | 为什么选 A 不选 B |

### 02 产品与体验（What）

| 文档 | 回答什么 |
|------|----------|
| [用户故事与用例](02-product/user-stories.md) | 用户怎么完成任务 |
| [信息架构与交互规范](02-product/ia-interaction-spec.md) | 界面结构、术语统一 |
| [验收标准与测试场景](02-product/acceptance-test-scenarios.md) | 什么叫「做完」 |
| [指标定义](02-product/metrics.md) | 北极星怎么算 |

### 03 工程

| 文档 | 回答什么 |
|------|----------|
| [沙箱隔离预研](03-engineering/sandbox-isolation.md) | 制作 Agent 的多租户安全：威胁模型、每任务容器隔离设计、ECS 验证方案 |

### 工程文档（现存）

- [AGENTS.md](../AGENTS.md) — 开发环境与服务运行说明
- [deploy/README.md](../deploy/README.md) — 阿里云部署指南（含大陆网络适配）
- [prototype/mvp-ui/README.md](../prototype/mvp-ui/README.md) — 前端原型运行说明
- [prototype/templates/baas-static/TEMPLATE_GUIDE.md](../prototype/templates/baas-static/TEMPLATE_GUIDE.md) — 黄金模板使用指南（制作 Agent 读）
