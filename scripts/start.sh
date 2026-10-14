#!/usr/bin/env bash
# Start AI Policy Foundry local stack:
#   - Backend API  :3001  (Express + agents + Phoenix tracing)
#   - Frontend SPA :8080  (Vite)
#   - Phoenix      :6006  (optional; starts Docker container if present & stopped)
#
# Usage:
#   ./scripts/start.sh
#   ./scripts/start.sh --no-phoenix
#   ./scripts/start.sh --seed-phoenix   # also upload eval datasets to Phoenix UI

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT}/.run"
LOG_DIR="${RUN_DIR}/logs"
mkdir -p "${LOG_DIR}"

START_PHOENIX=1
SEED_PHOENIX=0
for arg in "$@"; do
  case "$arg" in
    --no-phoenix) START_PHOENIX=0 ;;
    --seed-phoenix) SEED_PHOENIX=1 ;;
    --help|-h)
      sed -n '2,12p' "$0"
      exit 0
      ;;
  esac
done

BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
PHOENIX_PORT="${PHOENIX_PORT:-6006}"
PHOENIX_CONTAINER="${PHOENIX_CONTAINER:-ai-spm-phoenix}"

is_listening() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
  else
    curl -sf "http://127.0.0.1:${port}" >/dev/null 2>&1
  fi
}

wait_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"
  local i=0
  while (( i < attempts )); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "✓ ${name} ready (${url})"
      return 0
    fi
    sleep 1
    ((i++)) || true
  done
  echo "✗ Timed out waiting for ${name} at ${url}" >&2
  return 1
}

# Launch npm run dev in a new session so it survives the parent shell exiting
# (Cursor/agent shells often SIGHUP background children when the command ends).
start_detached_npm() {
  local workdir="$1"
  local logfile="$2"
  local pidfile="$3"
  python3 - "$workdir" "$logfile" "$pidfile" <<'PY'
import os, subprocess, sys
workdir, logfile, pidfile = sys.argv[1], sys.argv[2], sys.argv[3]
os.chdir(workdir)
log = open(logfile, "ab", buffering=0)
proc = subprocess.Popen(
    ["npm", "run", "dev"],
    stdout=log,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    start_new_session=True,
    close_fds=True,
)
with open(pidfile, "w", encoding="utf-8") as fh:
    fh.write(str(proc.pid))
PY
}

echo "==> AI Policy Foundry startup"
echo "    root: ${ROOT}"

# --- Phoenix (observability) ---
if (( START_PHOENIX == 1 )); then
  if is_listening "${PHOENIX_PORT}"; then
    echo "✓ Phoenix already listening on :${PHOENIX_PORT}"
  elif command -v docker >/dev/null 2>&1; then
    if docker ps -a --format '{{.Names}}' | grep -qx "${PHOENIX_CONTAINER}"; then
      echo "→ Starting Phoenix container ${PHOENIX_CONTAINER}…"
      docker start "${PHOENIX_CONTAINER}" >/dev/null
      wait_http "http://127.0.0.1:${PHOENIX_PORT}" "Phoenix" 90 || true
    else
      echo "! Phoenix container '${PHOENIX_CONTAINER}' not found; leaving :${PHOENIX_PORT} as-is"
    fi
  else
    echo "! docker not available; skip Phoenix auto-start"
  fi
else
  echo "→ Skipping Phoenix (--no-phoenix)"
fi

# --- Backend ---
if is_listening "${BACKEND_PORT}"; then
  echo "✓ Backend already listening on :${BACKEND_PORT}"
else
  if [[ ! -d "${ROOT}/backend/node_modules" ]]; then
    echo "→ Installing backend dependencies…"
    (cd "${ROOT}/backend" && npm install)
  fi
  echo "→ Starting backend (npm run dev) on :${BACKEND_PORT}…"
  : >"${LOG_DIR}/backend.log"
  start_detached_npm "${ROOT}/backend" "${LOG_DIR}/backend.log" "${RUN_DIR}/backend.pid"
  # nodemon may spawn a child; wait on health endpoint
  wait_http "http://127.0.0.1:${BACKEND_PORT}/health" "Backend" 90
fi

# --- Frontend ---
if is_listening "${FRONTEND_PORT}"; then
  echo "✓ Frontend already listening on :${FRONTEND_PORT}"
else
  if [[ ! -d "${ROOT}/node_modules" ]]; then
    echo "→ Installing frontend dependencies…"
    (cd "${ROOT}" && npm install)
  fi
  echo "→ Starting frontend (npm run dev) on :${FRONTEND_PORT}…"
  : >"${LOG_DIR}/frontend.log"
  start_detached_npm "${ROOT}" "${LOG_DIR}/frontend.log" "${RUN_DIR}/frontend.pid"
  wait_http "http://127.0.0.1:${FRONTEND_PORT}/" "Frontend" 90
fi

# --- Optional Phoenix dataset sync ---
if (( SEED_PHOENIX == 1 )); then
  echo "→ Syncing Phoenix eval datasets…"
  (cd "${ROOT}/backend" && npm run phoenix:seed) || echo "! phoenix:seed failed (non-fatal)"
fi

cat >"${RUN_DIR}/status.json" <<EOF
{
  "startedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "backend": "http://127.0.0.1:${BACKEND_PORT}",
  "frontend": "http://127.0.0.1:${FRONTEND_PORT}",
  "phoenix": "http://127.0.0.1:${PHOENIX_PORT}",
  "health": "http://127.0.0.1:${BACKEND_PORT}/health",
  "logs": "${LOG_DIR}"
}
EOF

echo ""
echo "==> Stack is up"
echo "    Frontend : http://localhost:${FRONTEND_PORT}"
echo "    Backend  : http://localhost:${BACKEND_PORT}/health"
echo "    Phoenix  : http://localhost:${PHOENIX_PORT}"
echo "    Logs     : ${LOG_DIR}"
echo "    Shutdown : ./scripts/shutdown.sh"
