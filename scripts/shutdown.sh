#!/usr/bin/env bash
# Stop AI Policy Foundry local stack started by scripts/start.sh
#
# Usage:
#   ./scripts/shutdown.sh
#   ./scripts/shutdown.sh --phoenix   # also stop Phoenix Docker container
#   ./scripts/shutdown.sh --force     # kill by port even without PID files

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT}/.run"

STOP_PHOENIX=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --phoenix) STOP_PHOENIX=1 ;;
    --force) FORCE=1 ;;
    --help|-h)
      sed -n '2,10p' "$0"
      exit 0
      ;;
  esac
done

BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
PHOENIX_CONTAINER="${PHOENIX_CONTAINER:-ai-spm-phoenix}"

kill_pid_file() {
  local file="$1"
  local label="$2"
  if [[ -f "${file}" ]]; then
    local pid
    pid="$(cat "${file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      echo "→ Stopping ${label} (pid ${pid})…"
      # Kill process group if possible (covers npm/nodemon children)
      kill -TERM "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
      sleep 1
      if kill -0 "${pid}" 2>/dev/null; then
        kill -KILL "-${pid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
      fi
    else
      echo "→ ${label}: no live pid in ${file}"
    fi
    rm -f "${file}"
  fi
}

kill_port() {
  local port="$1"
  local label="$2"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    echo "✓ ${label}: nothing listening on :${port}"
    return 0
  fi
  echo "→ Stopping ${label} on :${port} (pids: ${pids})…"
  # shellcheck disable=SC2086
  kill -TERM ${pids} 2>/dev/null || true
  sleep 1
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill -KILL ${pids} 2>/dev/null || true
  fi
}

echo "==> AI Policy Foundry shutdown"

kill_pid_file "${RUN_DIR}/frontend.pid" "frontend"
kill_pid_file "${RUN_DIR}/backend.pid" "backend"

# Always clear app ports (handles orphaned nodemon/vite children)
kill_port "${FRONTEND_PORT}" "frontend"
kill_port "${BACKEND_PORT}" "backend"

if (( STOP_PHOENIX == 1 )); then
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "${PHOENIX_CONTAINER}"; then
    echo "→ Stopping Phoenix container ${PHOENIX_CONTAINER}…"
    docker stop "${PHOENIX_CONTAINER}" >/dev/null || true
  else
    echo "→ Phoenix container not running (or docker unavailable)"
  fi
else
  echo "→ Leaving Phoenix running (pass --phoenix to stop it)"
fi

if (( FORCE == 1 )); then
  # Extra sweep for common node entrypoints
  pkill -f "nodemon src/index.js" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
fi

rm -f "${RUN_DIR}/status.json" 2>/dev/null || true

echo ""
echo "==> App stack stopped"
echo "    Backend  :$(curl -sf http://127.0.0.1:${BACKEND_PORT}/health >/dev/null && echo ' STILL UP' || echo ' down')"
echo "    Frontend :$(curl -sf http://127.0.0.1:${FRONTEND_PORT}/ >/dev/null && echo ' STILL UP' || echo ' down')"
