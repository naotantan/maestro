#!/usr/bin/env bash
# migrate-secretary-todos.sh — 秘書室TODO (.company/secretary/todos/) を maestro Issues に移行する
#
# 使用方法:
#   bash migrate-secretary-todos.sh [--dry-run]
#
# 前提:
#   - MAESTRO_API_KEY 環境変数または ~/.maestro/api-key にAPIキーを設定
#   - MAESTRO_API_URL 環境変数で API URL を上書き可能（デフォルト: http://localhost:3000）

set -euo pipefail

COMPANY_DIR="/Users/naoto/Downloads/.company"
TODOS_DIR="${COMPANY_DIR}/secretary/todos"
MAESTRO_API_URL="${MAESTRO_API_URL:-http://localhost:3000}"
DRY_RUN=false

if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  echo "[DRY RUN モード] APIへの書き込みは行いません"
fi

# APIキーの取得
API_KEY="${MAESTRO_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$HOME/.maestro/api-key" ]; then
  API_KEY=$(cat "$HOME/.maestro/api-key" | tr -d '[:space:]')
fi

if [ -z "$API_KEY" ]; then
  echo "エラー: MAESTRO_API_KEY が設定されていません"
  echo "~/.maestro/api-key にAPIキーを記述するか、MAESTRO_API_KEY 環境変数を設定してください"
  exit 1
fi

if [ ! -d "$TODOS_DIR" ]; then
  echo "TODOディレクトリが見つかりません: $TODOS_DIR"
  exit 1
fi

MIGRATED=0
SKIPPED=0
ERRORS=0

# 直近14日分のTODOファイルを処理
for TODO_FILE in $(find "$TODOS_DIR" -name "*.md" -newer "$(date -v-14d '+%Y-%m-%d' 2>/dev/null || date -d '14 days ago' '+%Y-%m-%d')" 2>/dev/null | sort | head -30); do
  echo "処理中: $TODO_FILE"

  # Markdown のチェックボックスから未完了タスクを抽出
  # - [ ] タスク名 → 未完了
  # - [x] タスク名 → 完了済み（スキップ）
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]\[[[:space:]]\][[:space:]](.+)$ ]]; then
      TASK="${BASH_REMATCH[1]}"
      TASK=$(echo "$TASK" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

      if [ -z "$TASK" ]; then
        continue
      fi

      echo "  → 登録: $TASK"

      if $DRY_RUN; then
        MIGRATED=$((MIGRATED + 1))
        continue
      fi

      # maestro API に POST
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${MAESTRO_API_URL}/api/instructions" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$(python3 -c "import json; print(json.dumps({'text': '${TASK//\'/\\\'}'})")" \
        --max-time 10 \
        2>/dev/null || echo "000")

      if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
        MIGRATED=$((MIGRATED + 1))
      else
        echo "  ⚠️ 登録失敗 (HTTP $HTTP_STATUS): $TASK"
        ERRORS=$((ERRORS + 1))
      fi

    elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]\[[xX]\] ]]; then
      SKIPPED=$((SKIPPED + 1))
    fi
  done < "$TODO_FILE"
done

echo ""
echo "=== 移行完了 ==="
echo "登録: ${MIGRATED}件"
echo "完了済みスキップ: ${SKIPPED}件"
if [ $ERRORS -gt 0 ]; then
  echo "エラー: ${ERRORS}件"
fi
