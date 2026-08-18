#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 이상이 필요합니다." >&2
  exit 1
fi

node_version="$(node -p 'process.versions.node')"
node_major="${node_version%%.*}"
node_minor="${node_version#*.}"
node_minor="${node_minor%%.*}"
if (( node_major < 20 || (node_major == 20 && node_minor < 9) )); then
  echo "Next.js 16에는 Node.js 20.9 이상이 필요합니다. 현재 버전: ${node_version}" >&2
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo ".env.local 파일이 없습니다. .env.example을 복사해 GEMINI_API_KEY를 설정하세요." >&2
  exit 1
fi

npm ci
npm run build

PORT="${PORT:-3000}"
HOST_IP="${HOST_IP:-0.0.0.0}"
exec npm run start -- --hostname "$HOST_IP" --port "$PORT"
