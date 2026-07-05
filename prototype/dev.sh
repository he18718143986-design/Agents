#!/usr/bin/env bash
# PROTOTYPE — start agent-server + mvp-ui with real OpenHands engine (phase A).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${LLM_API_KEY:-}${DEEPSEEK_API_KEY:-}" ]]; then
  echo "Note: LLM_API_KEY not set — configure API key in the browser panel." >&2
fi

export OPENHANDS_AGENT_SERVER_CONFIG_PATH="$ROOT/prototype/agent-server.config.json"
mkdir -p "$ROOT/prototype/workspaces/mvp-demo" "$ROOT/prototype/.agent_tmp/conversations"

echo "==> Starting agent-server on http://127.0.0.1:8000"
uv run agent-server --host 127.0.0.1 --port 8000 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! curl -sf "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
  echo "Error: agent-server did not become healthy in time." >&2
  exit 1
fi

echo "==> Starting mvp-ui (Vite) — chat drives OpenHands engine"
cd "$ROOT/prototype/mvp-ui"
exec npm run dev
