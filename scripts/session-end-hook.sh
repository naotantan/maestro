#!/usr/bin/env bash
# session-end-hook.sh — Claude Code の Stop フックから呼ばれる
# セッション終了時に作業サマリーを maestro API に upsert する（1日1レコード）
#
# 前提:
#   - MAESTRO_API_KEY 環境変数にAPIキーを設定、または ~/.maestro/api-key に記述
#   - MAESTRO_API_URL 環境変数で API URL を上書き可能（デフォルト: http://localhost:3000）
#   - 既存の session-close-check.py が .company/document/sessions/ にサマリーを出力済み

set -euo pipefail

COMPANY_DIR="/Users/naoto/Downloads/.company"
TODAY=$(date '+%Y-%m-%d')
SUMMARY_FILE="${COMPANY_DIR}/document/sessions/${TODAY}-summary.md"
MAESTRO_API_URL="${MAESTRO_API_URL:-http://localhost:3000}"

# APIキーの取得（環境変数 → ~/.maestro/api-key の順で探す）
API_KEY="${MAESTRO_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$HOME/.maestro/api-key" ]; then
  API_KEY=$(cat "$HOME/.maestro/api-key" | tr -d '[:space:]')
fi

# APIキーがなければスキップ
if [ -z "$API_KEY" ]; then
  echo '{"continue": true}'
  exit 0
fi

# サマリーファイルがなければスキップ
if [ ! -f "$SUMMARY_FILE" ]; then
  echo '{"continue": true}'
  exit 0
fi

# 変更ファイル一覧（git diff）
CHANGED_FILES="[]"
if command -v git &>/dev/null; then
  GIT_ROOT=$(git -C "$COMPANY_DIR" rev-parse --show-toplevel 2>/dev/null || true)
  if [ -n "$GIT_ROOT" ]; then
    FILES=$(git -C "$GIT_ROOT" diff --name-only HEAD 2>/dev/null | head -50 | \
      python3 -c "import sys,json; lines=[l.strip() for l in sys.stdin if l.strip()]; print(json.dumps(lines))" 2>/dev/null || echo "[]")
    CHANGED_FILES="$FILES"
  fi
fi

# JSON ペイロードを構築
PAYLOAD=$(python3 - <<PYEOF
import json
summary = open("$SUMMARY_FILE", encoding="utf-8").read()
payload = {
    "summary": summary,
    "changed_files": $CHANGED_FILES,
    "session_ended_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
}
print(json.dumps(payload))
PYEOF
)

# 今日のレコードが既に存在するか確認（JST日付でフィルタ）
EXISTING_ID=$(curl -s \
  "${MAESTRO_API_URL}/api/session-summaries?limit=5" \
  -H "Authorization: Bearer ${API_KEY}" \
  --max-time 5 2>/dev/null | \
  python3 -c "
import sys, json
from datetime import datetime, timezone, timedelta
JST = timezone(timedelta(hours=9))
today = '${TODAY}'
data = json.load(sys.stdin).get('data', [])
for r in data:
    ts = r.get('session_ended_at', '')
    try:
        dt = datetime.fromisoformat(ts.replace('Z','+00:00')).astimezone(JST)
        if dt.strftime('%Y-%m-%d') == today:
            print(r['id'])
            break
    except Exception:
        pass
" 2>/dev/null || true)

if [ -n "$EXISTING_ID" ]; then
  # 既存レコードを PATCH（upsert）
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "${MAESTRO_API_URL}/api/session-summaries/${EXISTING_ID}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --max-time 5 2>/dev/null || echo "000")
else
  # 新規レコードを POST
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${MAESTRO_API_URL}/api/session-summaries" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --max-time 5 2>/dev/null || echo "000")
fi

echo '{"continue": true}'
