#!/usr/bin/env bash
# maestro-watch.sh — fswatch ベースのオートメーションランナー
#
# 監視対象:
#   1. ~/.maestro/queue/          — 指示書ジョブ（claude -p で順次実行）
#   2. ~/.claude/skills/          — スキル追加・変更 → maestro に自動同期
#   3. ~/.claude/agents/          — エージェント追加・変更 → maestro に自動同期
#   4. ~/.claude/projects/        — 新規セッションJSONL → maestro に自動取り込み
#
# 使い方:
#   export MAESTRO_API_KEY="your-api-key"
#   ./maestro-watch.sh
#
# 環境変数:
#   MAESTRO_API_KEY   — maestro の Bearer トークン（必須）
#   MAESTRO_API_URL   — API ベース URL（省略時: http://localhost:3000）
#   MAESTRO_QUEUE_DIR — キューディレクトリ（省略時: ~/.maestro/queue）

set -euo pipefail

QUEUE_DIR="${MAESTRO_QUEUE_DIR:-$HOME/.maestro/queue}"
DONE_DIR="$(dirname "$QUEUE_DIR")/done"
API_BASE="${MAESTRO_API_URL:-http://localhost:3000}"
API_KEY="${MAESTRO_API_KEY:-}"
SKILLS_DIR="$HOME/.claude/skills"
AGENTS_DIR="$HOME/.claude/agents"
PROJECTS_DIR="$HOME/.claude/projects"
# 既に取り込み済みのセッションIDを記録するファイル
IMPORTED_SESSIONS_FILE="$HOME/.maestro/imported-sessions.txt"
# セッションごとの最終取り込みサイズを記録（更新検知用）
SESSION_SIZES_FILE="$HOME/.maestro/session-sizes.txt"

if [ -z "$API_KEY" ]; then
  echo "❌ MAESTRO_API_KEY が未設定です"
  echo "   export MAESTRO_API_KEY=\"your-api-key\" を実行してください"
  exit 1
fi

mkdir -p "$QUEUE_DIR" "$DONE_DIR" "$(dirname "$IMPORTED_SESSIONS_FILE")"
touch "$IMPORTED_SESSIONS_FILE"
touch "$SESSION_SIZES_FILE"

# ─── ヘルパー ──────────────────────────────────────────────────────────────

api_call() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_BASE$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $API_KEY" \
      -d "$body"
  else
    curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_BASE$path" \
      -H "Authorization: Bearer $API_KEY"
  fi
}

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ─── 1. 指示書ジョブ実行 ──────────────────────────────────────────────────

process_job_file() {
  local file="$1"
  [ -f "$file" ] || return 0

  local filename
  filename=$(basename "$file")

  # ファイル名フォーマット: {uuid}-step-{N}.txt
  if [[ ! "$filename" =~ ^([a-f0-9-]{36})-step-([0-9]+)\.txt$ ]]; then
    return 0
  fi

  local job_id="${BASH_REMATCH[1]}"
  local step="${BASH_REMATCH[2]}"
  local session_name="mj-${job_id:0:8}"

  log "▶ ジョブ ${job_id:0:8} — ステップ $step 実行中..."

  local instruction exit_code=0
  instruction=$(cat "$file")

  if [ "$step" -eq 1 ]; then
    # --session-id でジョブIDをセッションUUIDとして固定（-r で再開できるようにするため）
    claude --session-id "$job_id" -p "$instruction" --dangerously-skip-permissions || exit_code=$?
  else
    # ジョブIDはUUID形式なので -r で直接再開可能
    claude -r "$job_id" -p "$instruction" --dangerously-skip-permissions || exit_code=$?
  fi

  mv "$file" "$DONE_DIR/" 2>/dev/null || true

  if [ "$exit_code" -eq 0 ]; then
    log "✅ ステップ $step 完了"
    api_call POST "/api/playbooks/jobs/$job_id/step-complete" "{\"step\": $step}" > /dev/null
  else
    log "❌ ステップ $step エラー (終了コード: $exit_code)"
    api_call POST "/api/playbooks/jobs/$job_id/error" \
      "{\"step\": $step, \"error\": \"claude exited with code $exit_code\"}" > /dev/null
  fi
}

# ─── 2. プラグインホットリロード ──────────────────────────────────────────

# デバウンス用: 最後の sync 時刻
LAST_PLUGIN_SYNC=0

sync_plugins() {
  local now
  now=$(date +%s)
  # 10秒以内に sync 済みなら skip（バースト防止）
  if (( now - LAST_PLUGIN_SYNC < 10 )); then
    return 0
  fi
  LAST_PLUGIN_SYNC=$now

  log "🔄 スキル/エージェント変更を検知 — maestro に同期中..."
  local code
  code=$(api_call POST "/api/plugins/sync" '{}')
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    log "✅ プラグイン同期完了 (HTTP $code)"
  else
    log "⚠️  プラグイン同期失敗 (HTTP $code)"
  fi
}

# ─── 3. セッションログ自動取り込み ────────────────────────────────────────

import_session_jsonl() {
  local file="$1"
  [ -f "$file" ] || return 0

  # UUID.jsonl 形式のみ処理
  local filename
  filename=$(basename "$file")
  if [[ ! "$filename" =~ ^[a-f0-9-]{36}\.jsonl$ ]]; then
    return 0
  fi

  local session_id="${filename%.jsonl}"

  # ファイルが小さすぎる（セッション途中）場合はスキップ
  local size
  size=$(wc -c < "$file")
  if (( size < 500 )); then
    return 0
  fi

  # 取り込み済みの場合: 前回サイズと比較し、十分に増加していれば更新（進行中セッション対応）
  if grep -qF "$session_id" "$IMPORTED_SESSIONS_FILE" 2>/dev/null; then
    local last_size
    last_size=$(grep -F "$session_id" "$SESSION_SIZES_FILE" 2>/dev/null | awk '{print $2}' | tail -1)
    last_size="${last_size:-0}"
    # 50KB以上増加した場合のみ再取り込み（頻繁な更新を防ぐ）
    if (( size - last_size < 51200 )); then
      return 0
    fi
    log "🔄 セッション ${session_id:0:8} を更新中 (${last_size}→${size} bytes)..."
  else
    log "📥 セッション ${session_id:0:8} を取り込み中..."
  fi

  # Python3 で JSONL を解析してサマリー情報と成果物を抽出

  # Python3 で JSONL を解析してサマリー情報と成果物を抽出（外部スクリプトを使用）
  local parse_output
  parse_output=$(python3 "$HOME/.maestro/parse-session.py" "$file" "$session_id") || {
    log "⚠️  セッション ${session_id:0:8} の解析失敗"
    return 0
  }


  if [ -z "$parse_output" ]; then
    return 0
  fi

  # セッションサマリーを登録
  local payload
  payload=$(echo "$parse_output" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d[\"session_summary\"], ensure_ascii=False))")

  local code
  code=$(api_call POST "/api/session-summaries" "$payload")

  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    # 初回のみ imported-sessions.txt に追記
    if ! grep -qF "$session_id" "$IMPORTED_SESSIONS_FILE" 2>/dev/null; then
      echo "$session_id" >> "$IMPORTED_SESSIONS_FILE"
    fi
    # 最終取り込みサイズを更新（既存行を置き換え）
    grep -vF "$session_id" "$SESSION_SIZES_FILE" 2>/dev/null > "${SESSION_SIZES_FILE}.tmp" || true
    echo "$session_id $size" >> "${SESSION_SIZES_FILE}.tmp"
    mv "${SESSION_SIZES_FILE}.tmp" "$SESSION_SIZES_FILE"
    log "✅ セッション ${session_id:0:8} 取り込み完了 (HTTP $code, ${size} bytes)"
  else
    log "⚠️  セッション ${session_id:0:8} 取り込み失敗 (HTTP $code)"
    return 0
  fi

  # 成果物を自動登録
  local artifact_count
  artifact_count=$(echo "$parse_output" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get(\"artifacts\", [])))")

  if [ "${artifact_count:-0}" -gt 0 ]; then
    log "📦 成果物 ${artifact_count} 件を登録中..."
    local registered=0
    while IFS= read -r artifact_json; do
      [ -z "$artifact_json" ] && continue
      local art_payload
      art_payload=$(echo "$artifact_json" | python3 -c "import sys,json; d=json.load(sys.stdin); d[\"session_id\"]=\"$session_id\"; print(json.dumps(d, ensure_ascii=False))")
      local art_code
      art_code=$(api_call POST "/api/artifacts" "$art_payload")
      if [ "$art_code" = "200" ] || [ "$art_code" = "201" ]; then
        registered=$((registered+1))
      fi
    done < <(echo "$parse_output" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(json.dumps(a, ensure_ascii=False)) for a in d.get(\"artifacts\",[])]")
    log "✅ 成果物 ${registered}/${artifact_count} 件登録完了"
  fi
}

# ─── 起動時: 既存ファイルを処理 ───────────────────────────────────────────

log "🎯 Maestro Runner 起動"
log "   ジョブキュー: $QUEUE_DIR"
log "   スキル監視:   $SKILLS_DIR / $AGENTS_DIR"
log "   セッション監視: $PROJECTS_DIR"
log "   API: $API_BASE"
echo ""

# 既存キューファイルを処理
for f in "$QUEUE_DIR"/*.txt; do
  [ -f "$f" ] && process_job_file "$f"
done

# 既存セッション（未取り込み）を処理
log "📂 未取り込みセッションをスキャン中..."
find "$PROJECTS_DIR" -maxdepth 2 -name "*.jsonl" -newer "$IMPORTED_SESSIONS_FILE" 2>/dev/null | while read -r f; do
  import_session_jsonl "$f"
done

log "👀 監視開始... (Ctrl+C で停止)"

# ─── fswatch メイン監視ループ ─────────────────────────────────────────────

fswatch -0 -r \
  --event Created --event Updated --event Renamed \
  "$QUEUE_DIR" \
  "$SKILLS_DIR" \
  "$AGENTS_DIR" \
  "$PROJECTS_DIR" \
  2>/dev/null | while read -d "" file; do

  case "$file" in
    # ジョブキュー（ブロッキング処理のためバックグラウンドで実行）
    "$QUEUE_DIR"/*)
      [[ "$file" == *.txt ]] && process_job_file "$file" &
      ;;
    # スキル/エージェント変更
    "$SKILLS_DIR"/*|"$AGENTS_DIR"/*)
      sync_plugins &
      ;;
    # セッションログ
    "$PROJECTS_DIR"/*)
      [[ "$file" == *.jsonl ]] && import_session_jsonl "$file" &
      ;;
  esac

done
