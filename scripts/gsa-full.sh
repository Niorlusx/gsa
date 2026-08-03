#!/bin/bash
# GSA full command script — env load + A/B provider + automations
# Usage:
#   ./scripts/gsa-full.sh smoke|doctor|status|version|hub|supervisor|worker <id> <brief>|ab-a|ab-b|ab-c|ab-d
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [[ -f env.sh ]]; then
  # shellcheck disable=SC1091
  source env.sh
fi

export GROK_LICENSE="${GROK_LICENSE:-GSA-DEMO-2026-LIVE}"
export GSA_ENV="${GSA_ENV:-development}"
export GSA_SAVE="${GSA_SAVE:-1}"
export GSA_WEB_HOST="${GSA_WEB_HOST:-0.0.0.0}"
export GSA_WEB_PORT="${GSA_WEB_PORT:-8080}"

CMD="${1:-help}"
shift || true

run_cli() {
  if [[ -f gsa.py ]]; then
    python3 gsa.py "$@"
  else
    python3 gsa "$@"
  fi
}

case "$CMD" in
  smoke)     run_cli smoke ;;
  doctor)    run_cli doctor ;;
  status)    run_cli status ;;
  version)   run_cli version ;;
  schema)    run_cli schema 2>/dev/null || cat gsa.system.json ;;
  license)   run_cli license ;;
  hub|serve)
    echo "GSA Hub → http://${GSA_WEB_HOST}:${GSA_WEB_PORT}"
    run_cli serve
    ;;
  supervisor|daemon)
    run_cli supervisor
    ;;
  worker)
    WID="${1:?worker id 1-8}"
    shift
    BRIEF="${*:-${GSA_BRIEF:-}}"
    if [[ -z "$BRIEF" ]]; then
      echo "Usage: $0 worker <id> <brief>" >&2
      exit 2
    fi
    run_cli worker "$WID" "$BRIEF"
    ;;
  ab-a)
    export GSA_PROVIDER=xai
    export GSA_MODEL="${GSA_MODEL:-grok-4.5}"
    echo "A/B → versionA provider=xai model=$GSA_MODEL"
    run_cli status
    ;;
  ab-b)
    export GSA_PROVIDER=deepseek
    export GSA_MODEL="${GSA_MODEL:-deepseek-chat}"
    echo "A/B → versionB provider=deepseek model=$GSA_MODEL"
    run_cli status
    ;;
  ab-c)
    export GSA_PROVIDER=mistral
    export GSA_MODEL="${GSA_MODEL:-mistral-small-latest}"
    echo "A/B → versionC provider=mistral model=$GSA_MODEL"
    run_cli status
    ;;
  ab-d|gemini)
    export GSA_PROVIDER=gemini
    export GSA_MODEL="${GSA_MODEL:-gemini-2.5-flash}"
    echo "A/B → versionD provider=gemini model=$GSA_MODEL (Workspace / Spark path)"
    run_cli status
    ;;
  forever)
    exec ./run-forever.sh serve
    ;;
  all)
    run_cli smoke
    run_cli doctor || true
    run_cli version
    echo "Skills: $(find skills -name SKILL.md | wc -l)"
    echo "System JSON: gsa.system.json"
    echo "Ready. Set API key then: $0 worker 8 \"brief\""
    ;;
  help|*)
    cat <<EOF
GSA full script — env-loaded automations

  $0 all                 smoke + doctor + version
  $0 smoke|doctor|status|version|license|schema
  $0 worker <id> <brief> non-interactive agent
  $0 hub                 web management hub
  $0 supervisor          24/7 auto-restart
  $0 forever             run-forever serve
  $0 ab-a|ab-b|ab-c|ab-d  xai / deepseek / mistral / gemini (Workspace)

Env: .env or env.sh — GROK_API_KEY / GEMINI_API_KEY, GROK_LICENSE, GSA_PROVIDER, GSA_MODEL
EOF
    ;;
esac
