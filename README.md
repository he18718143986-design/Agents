# Stagent（Agent 工坊）

Stagent MVP 原型 — 让非技术用户通过「对话 + 阶段拍板」把想法变成可试用的应用。

**在线体验：** https://he18718143986-design.github.io/Agents/
（静态托管环境请点击「先用体验模式」，无需 API 密钥即可走完全流程）

## 两种运行模式

| 模式 | 说明 | 需要什么 |
| --- | --- | --- |
| 体验模式 | 内置脚本驱动全流程（需求 → 拍板 → 制作 → 验收 → 上线），生成可交互的演示应用 | 无需任何密钥，GitHub Pages 也可用 |
| 真实引擎 | OpenHands agent-server 驱动教练对话、制作 Agent、部署 Agent | 本地 agent-server + LLM API Key（DeepSeek 等） |

## 本地运行

### 仅前端（体验模式）

```bash
cd prototype/mvp-ui
npm install
npm run dev
```

打开 http://localhost:5173/app ，在弹窗中点击「先用体验模式」。

### 连接真实 OpenHands 引擎

依赖已在根目录 `pyproject.toml` 中声明，使用 [uv](https://docs.astral.sh/uv/) 安装：

```bash
uv sync
bash prototype/dev.sh   # 一键启动 agent-server + 前端
```

API Key 提供方式（任选其一）：

- 环境变量：启动前 `export DEEPSEEK_API_KEY=sk-...`（或 `LLM_API_KEY` / `LLM_MODEL` / `LLM_BASE_URL`），前端「连接 AI」弹窗会出现「使用云端已配置的密钥连接」按钮，无需手动填写；
- 页面填写：在「连接 AI」弹窗中选择服务商并粘贴 Key（仅保存在当前标签页）。

## 目录结构

```
pyproject.toml               # OpenHands 引擎依赖（uv sync）
prototype/
├── mvp-ui/                  # React + Vite 前端
├── dev.sh                   # 一键启动 agent-server + 前端
├── agent-server.config.json # agent-server 配置
└── test_requirement_input.py# 需求输入冒烟测试脚本
```

详细说明见 [prototype/mvp-ui/README.md](prototype/mvp-ui/README.md)。
