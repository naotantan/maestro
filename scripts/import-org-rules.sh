#!/usr/bin/env bash
# import-org-rules.sh — .company/CLAUDE.md の組織ルールを maestro Settings に保存する
#
# 使用方法:
#   bash import-org-rules.sh
#
# 前提:
#   - MAESTRO_API_KEY 環境変数または ~/.maestro/api-key にAPIキーを設定

set -euo pipefail

COMPANY_DIR="/Users/naoto/Downloads/.company"
ORG_RULES_FILE="${COMPANY_DIR}/CLAUDE.md"
MAESTRO_API_URL="${MAESTRO_API_URL:-http://localhost:3000}"

# APIキーの取得
API_KEY="${MAESTRO_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$HOME/.maestro/api-key" ]; then
  API_KEY=$(cat "$HOME/.maestro/api-key" | tr -d '[:space:]')
fi

if [ -z "$API_KEY" ]; then
  echo "エラー: MAESTRO_API_KEY が設定されていません"
  exit 1
fi

if [ ! -f "$ORG_RULES_FILE" ]; then
  echo "エラー: 組織ルールファイルが見つかりません: $ORG_RULES_FILE"
  exit 1
fi

# JSON エスケープして PATCH /api/settings に送信
HTTP_STATUS=$(python3 - <<PYEOF
import json, urllib.request, urllib.error, os

content = open("$ORG_RULES_FILE", encoding="utf-8").read()
payload = json.dumps({"org_rules": content}).encode("utf-8")

req = urllib.request.Request(
    "$MAESTRO_API_URL/api/settings",
    data=payload,
    headers={
        "Authorization": "Bearer $API_KEY",
        "Content-Type": "application/json",
    },
    method="PATCH",
)

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(resp.status)
except urllib.error.HTTPError as e:
    print(e.code)
except Exception as e:
    print(f"0 ({e})")
PYEOF
)

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ 組織ルールを maestro に保存しました"
  CHAR_COUNT=$(wc -c < "$ORG_RULES_FILE")
  echo "   ファイルサイズ: ${CHAR_COUNT} bytes"
else
  echo "⚠️ 保存失敗 (HTTP $HTTP_STATUS)"
  exit 1
fi
