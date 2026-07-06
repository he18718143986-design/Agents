# Stagent (Agent 工坊)

Prototype that turns ideas into apps through a conversational, stage-gated workflow. A React + Vite frontend (`prototype/mvp-ui`) is the core product; an optional Python OpenHands agent-server powers the "real engine" mode.

## Cursor Cloud specific instructions

### Services

| Service | Required | Run command | Notes |
| --- | --- | --- | --- |
| `mvp-ui` (Vite frontend) | Yes | `cd prototype/mvp-ui && npm run dev` → http://localhost:5173/app | Runs fully standalone in "体验模式" (demo mode): no backend, no DB, no API key. In the "连接 AI" modal, click "先用体验模式" to enter demo mode. Use the Ports panel to open port `5173`. |
| OpenHands `agent-server` | No (optional "真实引擎" mode) | `bash prototype/dev.sh` (starts agent-server + frontend), or standalone `uv run agent-server --host 127.0.0.1 --port 8000` with `OPENHANDS_AGENT_SERVER_CONFIG_PATH=$(pwd)/prototype/agent-server.config.json` | Requires an LLM API key (`DEEPSEEK_API_KEY` or `LLM_API_KEY`). On Cursor Cloud a DeepSeek key is injected as the secret env var `stagent` — export it first: `export DEEPSEEK_API_KEY="$stagent" LLM_API_KEY="$stagent"`. Health check: `curl http://127.0.0.1:8000/health`. No database; uses local filesystem workspaces. |
| Production server (`server/index.ts`) | No (production form) | `cd prototype/mvp-ui && npm run build && npm run serve` → http://localhost:8080/app | Serves the built frontend, hosts the engine gateway (`/prototype/api/*`, incl. `GET /prototype/api/conversation-usage/<id>` for token stats), and proxies `/api` + `/sockets` (WebSocket) to the agent-server. Env: `PORT`, `AGENT_SERVER_URL`, optional `BASIC_AUTH_USER`+`BASIC_AUTH_PASSWORD` (site-wide Basic Auth). Aliyun deployment: see `deploy/README.md` (Docker Compose; docker is NOT available in this VM, test the server directly instead). |

### Lint / build / test

- Lint: `cd prototype/mvp-ui && npm run lint` (oxlint).
- Build: `cd prototype/mvp-ui && npm run build` (`tsc -b && vite build`).
- There is no automated test suite. `prototype/test_requirement_input.py` is a manual smoke script for the engine and needs an LLM API key.

### baas-mvp data tier (PocketBase)

- Real-engine builds now target the "golden template" in `prototype/templates/baas-static/` (login + cloud persistence via PocketBase; the build agent edits only `modules.js` / `custom.css`).
- Each build slug gets its own PocketBase instance managed by `prototype/mvp-ui/server/pocketbase.ts` (binary auto-downloaded to `prototype/.pocketbase/bin/`, data in `prototype/workspaces/pocketbase/<slug>/`), reachable through the `/pb/<slug>/` proxy on both the Vite dev server and the production server.
- Demo login for generated apps: `demo@stagent.online` / `demo1234567`.
- Platform accounts + cloud project storage use the reserved slug `platform` (`/pb/platform/`, `projects` collection with owner-scoped rules). Frontend: `src/engine/platformClient.ts` + `projectStore.ts` (cloud when logged in, localStorage fallback). Note: `vite.config.ts` patches the pocketbase SDK's `async import(` method name to avoid Vite import-analysis mangling.

### Automated app check (acceptance evidence)

- `POST /prototype/api/run-app-check` with `{conversation_id, project_slug}` runs deterministic Playwright checks against a generated baas app (load/login/modules/CRUD/console) and writes screenshot evidence to the workspace `checks/` dir. UI entry: 验收清单 tab → 自动体检 panel.
- Requires `playwright-core` (npm dep) + Chromium (`npx playwright install chromium`); returns 501 if missing.

### Non-obvious notes

- `uv` is the Python package manager for the optional engine, but it is NOT part of the base image. It was installed to `~/.local/bin` and is sourced via `~/.bashrc`. If `uv` is missing on a fresh VM, reinstall with `curl -LsSf https://astral.sh/uv/install.sh | sh`, then `uv sync`.
- The Vite dev server proxies `/api` → `127.0.0.1:8000` and `/sockets` → ws `127.0.0.1:8000`; these only resolve when the agent-server is running (real engine mode). Demo mode does not use them.
- Demo-mode "外部方案" flows may open external Feishu (飞书) links that 404 — this is expected in the prototype and does not indicate a broken local app.
