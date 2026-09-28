#!/usr/bin/env bash
# Starts the FastAPI backend (port 8000) and the Vite frontend (port 5173).
# Ctrl+C stops both.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Vite needs Node 18+; switch via nvm if available.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi

if ! curl -s http://localhost:11434/api/version >/dev/null; then
  echo "⚠️  Ollama doesn't seem to be running on localhost:11434 (start it with: ollama serve)"
fi

# First-run setup
if [ ! -d "$ROOT/backend/.venv" ]; then
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm install)
fi

cleanup() {
  trap - INT TERM EXIT
  echo; echo "Stopping servers..."
  kill $BACK_PID $FRONT_PID 2>/dev/null || true
  wait 2>/dev/null
}
trap cleanup INT TERM EXIT

(cd "$ROOT/backend" && exec .venv/bin/uvicorn main:app --reload --port 8000) &
BACK_PID=$!

(cd "$ROOT/frontend" && exec npm run dev) &
FRONT_PID=$!

echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
wait
