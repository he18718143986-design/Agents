# ADR-006：生产服务器用 Node，与 Vite 中间件共享网关

> 状态：已采纳 ｜ 2026-07-05（PR #3 实现）

## 背景

引擎网关逻辑（会话引导、密钥回退、engine-status）最初寄生在 Vite dev 中间件里，无法生产部署（P0-2 问题）。

## 决策

抽出框架无关的 `server/gateway.ts`（纯逻辑），由两个薄适配层共用：Vite dev 中间件（开发）与 `server/index.ts`（Express 生产服务器：静态前端 + 网关 + `/api`、`/sockets`、`/pb` 反向代理）。部署形态：docker compose（web + agent-server 双容器）。

## 备选与否决理由

| 备选 | 否决理由 |
|---|---|
| FastAPI（Python）独立后端 | 网关逻辑依赖 TS 提示词模块（canvasPrompt 等），跨语言要么重复维护要么引入构建复杂度 |
| 继续用 Vite preview + 中间件 | preview 不执行 configureServer 中间件，非生产路径 |
| Next.js 全家桶重构 | 迁移成本高，P1 不需要 SSR |

## 后果

- 正：dev 与生产行为一致（同一 gateway）；一份提示词源码
- 负：Node 服务器承担进程管理职责（PocketBase 子进程），规模化后（P3）应拆分独立的实例编排服务
