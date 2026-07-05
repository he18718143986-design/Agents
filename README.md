# Agents

Agent 工坊 MVP UI 原型 — 可交互的前端体验 Demo。

**在线体验：** https://he18718143986-design.github.io/Agents/

> 若页面 404，请到 GitHub 仓库 **Settings → Pages**，确认 Source 为 **Deploy from a branch → gh-pages**（或 GitHub Actions 部署完成后自动可用）。

## 本地运行

### 仅 UI mock（无需 API Key）

```bash
cd prototype/mvp-ui
npm install
npm run dev
```

### 连接 OpenHands 引擎

需要在上级 monorepo 中安装 `openhands-agent-server` 后运行：

```bash
bash prototype/dev.sh
```

## 目录结构

```
prototype/
├── mvp-ui/                  # React + Vite 前端
├── dev.sh                   # 一键启动 agent-server + 前端
├── agent-server.config.json # agent-server 配置
└── test_requirement_input.py
```

详细说明见 [prototype/mvp-ui/README.md](prototype/mvp-ui/README.md)。
