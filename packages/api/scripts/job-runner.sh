#!/bin/bash
# maestro ジョブランナー — pending ジョブをポーリングして claude -p で実行
#
# 使い方: ./job-runner.sh
# 停止: Ctrl+C または SIGTERM
#
# 環境変数:
#   MAESTRO_API_URL  (default: http://localhost:3000)
#   MAESTRO_API_KEY  (default: ~/.maestro/api-key から読み取り)
#   POLL_INTERVAL    (default: 10 秒)

set -euo pipefail

API_URL="${MAESTRO_API_URL:-http://localhost:3000}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"

# APIキー取得
if [ -n "${MAESTRO_API_KEY:-}" ]; then
  API_KEY="$MAESTRO_API_KEY"
elif [ -f "$HOME/.maestro/api-key" ]; then
  API_KEY=$(cat "$HOME/.maestro/api-key")
else
  echo "[JobRunner] ERROR: API key not found" >&2
  exit 1
fi

AUTH="Authorization: Bearer $API_KEY"
RUNNING_PID=""

cleanup() {
  if [ -n "$RUNNING_PID" ] && kill -0 "$RUNNING_PID" 2>/dev/null; then
    echo "[JobRunner] Stopping running job (PID $RUNNING_PID)..."
    kill "$RUNNING_PID" 2>/dev/null || true
    wait "$RUNNING_PID" 2>/dev/null || true
  fi
  echo "[JobRunner] Stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "[JobRunner] Started. Polling ${API_URL} every ${POLL_INTERVAL}s"

while true; do
  # pending ジョブを1件取得
  RESPONSE=$(curl -sf "${API_URL}/api/jobs/pending" -H "$AUTH" 2>/dev/null || echo '{"data":null}')
  JOB_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['id'] if d else '')" 2>/dev/null || echo "")

  if [ -z "$JOB_ID" ]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  PROMPT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['prompt'])" 2>/dev/null)
  echo "[JobRunner] Processing job $JOB_ID: ${PROMPT:0:80}..."

  # ステータスを running に更新
  curl -sf -X PATCH "${API_URL}/api/jobs/${JOB_ID}" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"status":"running"}' > /dev/null 2>&1

  # claude -p で実行（バックグラウンドで実行して PID を記録）
  RESULT_FILE=$(mktemp)
  (
    claude -p "$PROMPT" --output-format text > "$RESULT_FILE" 2>&1
  ) &
  RUNNING_PID=$!
  wait "$RUNNING_PID" 2>/dev/null
  EXIT_CODE=$?
  RUNNING_PID=""

  if [ $EXIT_CODE -eq 0 ]; then
    RESULT=$(cat "$RESULT_FILE")
    # JSON エスケープ
    ESCAPED=$(python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" < "$RESULT_FILE")
    curl -sf -X PATCH "${API_URL}/api/jobs/${JOB_ID}" \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d "{\"status\":\"done\",\"result\":${ESCAPED}}" > /dev/null 2>&1
    echo "[JobRunner] Job $JOB_ID done."
  else
    ERROR=$(cat "$RESULT_FILE" | head -20)
    ESCAPED=$(echo "$ERROR" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
    curl -sf -X PATCH "${API_URL}/api/jobs/${JOB_ID}" \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d "{\"status\":\"error\",\"error_message\":${ESCAPED}}" > /dev/null 2>&1
    echo "[JobRunner] Job $JOB_ID failed."
  fi

  rm -f "$RESULT_FILE"
  sleep 1
done
