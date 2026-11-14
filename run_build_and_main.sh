#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/web/frontend"
PYTHON_BIN="${PYTHON_BIN:-python3}"

BUILD_FRONTEND=true
for arg in "$@"; do
    case "${arg}" in
        --setup-https|--validate-config|--help|-h|--version)
            BUILD_FRONTEND=false
            ;;
    esac
done

if [[ "${BUILD_FRONTEND}" == true ]]; then
    cd "${FRONTEND_DIR}"
    npm run build
fi

cd "${ROOT_DIR}"
if (( $# > 0 )); then
    exec "${PYTHON_BIN}" -m codex_telegram "$@"
fi
exec "${PYTHON_BIN}" main.py
