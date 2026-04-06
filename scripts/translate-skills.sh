#!/bin/bash
# スキルの usage_content をホスト側の claude -p で日本語翻訳し、DBに書き込む
# 使い方: bash scripts/translate-skills.sh

set -euo pipefail

SKILLS_DIR="$HOME/.claude/skills"
DB_CONTAINER="maestro-postgres"
DB_USER="maestro"
DB_NAME="maestro"

# カウンタ
translated=0
skipped=0
failed=0
total=0

echo "=== スキル使い方翻訳 ==="
echo "対象: $SKILLS_DIR"
echo ""

# DBから英語の usage_content を持つスキル一覧を取得
mapfile -t SKILLS < <(
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
    SELECT name FROM plugins
    WHERE usage_content IS NOT NULL
    AND length(usage_content) > 50
    ORDER BY name;
  "
)

echo "対象スキル: ${#SKILLS[@]} 件"
echo ""

for skill_name in "${SKILLS[@]}"; do
  skill_name=$(echo "$skill_name" | tr -d '[:space:]')
  [ -z "$skill_name" ] && continue
  total=$((total + 1))

  # DBから現在の usage_content を取得
  current=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
    SELECT usage_content FROM plugins WHERE name = '$skill_name' LIMIT 1;
  " 2>/dev/null)

  [ -z "$current" ] && { skipped=$((skipped + 1)); continue; }

  # すでに日本語かチェック（ASCII比率60%以下ならスキップ）
  ascii_count=$(echo "$current" | head -c 200 | LC_ALL=C tr -cd '[:print:]' | wc -c)
  total_count=$(echo "$current" | head -c 200 | wc -c)
  if [ "$total_count" -gt 0 ]; then
    ratio=$((ascii_count * 100 / total_count))
    if [ "$ratio" -lt 60 ]; then
      skipped=$((skipped + 1))
      continue
    fi
  fi

  echo -n "[$total] $skill_name ... "

  # claude -p で翻訳（5000文字に制限）
  truncated=$(echo "$current" | head -c 5000)
  result=$(echo "$truncated" | claude -p "以下の技術ドキュメントを日本語に翻訳してください。Markdown書式を維持してください。コード例はそのまま英語で残してください。翻訳結果だけを出力してください。" 2>/dev/null) || true

  if [ -z "$result" ] || [ "${#result}" -lt 50 ]; then
    echo "失敗"
    failed=$((failed + 1))
    continue
  fi

  # DBに書き込み（シングルクォートをエスケープ）
  escaped=$(echo "$result" | sed "s/'/''/g")
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
    UPDATE plugins SET usage_content = '$escaped', updated_at = NOW()
    WHERE name = '$skill_name';
  " > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo "完了"
    translated=$((translated + 1))
  else
    echo "DB書き込み失敗"
    failed=$((failed + 1))
  fi
done

echo ""
echo "=== 完了 ==="
echo "翻訳: $translated 件"
echo "スキップ(日本語済み): $skipped 件"
echo "失敗: $failed 件"
echo "合計: $total 件"
