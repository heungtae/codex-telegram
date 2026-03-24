#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/web/frontend"

cd "${FRONTEND_DIR}"
npm run build

cd "${ROOT_DIR}"
exec python3 main.py "$@"
