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

if ! grep -qE '^GEMINI_API_KEY=.+$' .env.local || grep -qE '^GEMINI_API_KEY=(your_gemini_api_key)?$' .env.local; then
  echo ".env.local의 GEMINI_API_KEY가 비어 있거나 예시 값입니다." >&2
  exit 1
fi

mkdir -p data
if ! touch data/.startup-write-check && rm -f data/.startup-write-check; then
  echo "data/ 디렉터리에 쓰기 권한이 없습니다. 서버 실행 계정에 권한을 부여하세요." >&2
  exit 1
fi

echo "Story Weaver 시작 준비 완료: Node ${node_version}, data/ 쓰기 가능, Gemini 키 감지"
npm ci
npm run build

PORT="${PORT:-3000}"
HOSTNAME="${HOSTNAME:-0.0.0.0}"
exec npm run start -- --hostname "$HOSTNAME" --port "$PORT"