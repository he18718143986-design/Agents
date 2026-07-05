# Stagent MVP UI 原型

可交互的前端原型：**营销首页 `/` + 应用 `/app`（左侧聊天 + 右侧画布 + 阶段门确认）**。

## 两种模式

- **体验模式（默认推荐）**：内置脚本驱动整个流程，无需 API 密钥和后端。制作阶段会根据你确认的需求生成一个**可真实操作**的演示应用（添加记录、删除、导出 CSV，数据保存在浏览器 localStorage）。
- **真实引擎模式**：左侧聊天、制作、部署均由 OpenHands agent-server 驱动，需要本地 agent-server + LLM API Key。

## 在线体验

**https://he18718143986-design.github.io/Agents/**

GitHub Pages 是静态托管，没有 agent-server，请在「连接 AI」弹窗点击**「先用体验模式」**。

## 本地运行

### 仅前端（体验模式）

```bash
cd prototype/mvp-ui
npm install
npm run dev
```

### 连接真实 OpenHands 引擎

```bash
# 仓库根目录
uv sync

# 方式一：一键启动（agent-server + 前端）
export DEEPSEEK_API_KEY=sk-...   # 可选：配置后页面可一键连接
bash prototype/dev.sh

# 方式二：分开启动
export OPENHANDS_AGENT_SERVER_CONFIG_PATH="$(pwd)/prototype/agent-server.config.json"
uv run agent-server --host 127.0.0.1 --port 8000
# 另一个终端
cd prototype/mvp-ui && npm run dev
```

启动后打开 http://localhost:5173/app ：

- 若服务器已配置 `DEEPSEEK_API_KEY` / `LLM_API_KEY`，弹窗会出现「使用云端已配置的密钥连接」按钮；
- 否则在弹窗中选择服务商并粘贴 API Key（密钥仅保存在当前标签页）。

### 远程 / 云端工作区如何打开 localhost？

- **方式 A：端口转发（推荐）**：在 Cursor 底部 Ports 面板添加端口 `5173`，点击 Open in Browser。
- **方式 B：GitHub Pages 在线地址**（仅体验模式）。

## 体验路径

1. **探索** — 描述想法，回答 Agent 追问，右侧同步需求草稿与方案对比，拍板路线
2. **需求整理** — 补全目标用户 / 验收标准 / 时间预期，确认需求文档
3. **选型与风格** — 选择技术路线（网页 / 小程序 / 桌面）与界面风格
4. **制作与验收** — 观看制作进度，试用预览，**对照需求文档的验收标准逐条勾选**
5. **测试与上线** — 测试环境试用 → 上线检查 → 正式发布

## 技术栈

- React + TypeScript + Vite + Tailwind CSS v4
- 体验模式：`src/engine/demoCoach.ts`（脚本教练）+ `src/engine/demoBuilder.ts`（演示应用生成器）
- 真实引擎：OpenHands agent-server（HTTP + WebSocket，见 `src/engine/openhandsClient.ts`）

## 说明

- 本原型用于验证 UX；体验模式不代表真实 Agent 能力
- 真实引擎当前建造档位为 static-mvp（静态 Web MVP），数据库 / 登录 / 小程序真机在 roadmap
