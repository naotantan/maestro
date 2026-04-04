#!/usr/bin/env bash
# session-start-hook.sh — Claude Code の SessionStart フックから呼ばれる
# maestro API からセッションコンテキストを取得し、Claude Code に渡す
#
# 前提:
#   - MAESTRO_API_KEY 環境変数にAPIキーを設定、または ~/.maestro/api-key に記述
#   - MAESTRO_API_URL 環境変数で API URL を上書き可能（デフォルト: http://localhost:3000）

set -euo pipefail

MAESTRO_API_URL="${MAESTRO_API_URL:-http://localhost:3000}"

# APIキーの取得
API_KEY="${MAESTRO_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$HOME/.maestro/api-key" ]; then
  API_KEY=$(cat "$HOME/.maestro/api-key" | tr -d '[:space:]')
fi

# APIキーがなければ何もしない
if [ -z "$API_KEY" ]; then
  echo '{}'
  exit 0
fi

# maestro からセッションコンテキストを取得
RESPONSE=$(curl -s \
  -H "Authorization: Bearer ${API_KEY}" \
  "${MAESTRO_API_URL}/api/session-context" \
  --max-time 5 \
  2>/dev/null || echo '{}')

# レスポンスが空または失敗の場合はスキップ
if [ -z "$RESPONSE" ] || [ "$RESPONSE" = "{}" ]; then
  echo '{}'
  exit 0
fi

# Python で整形して additionalContext として返す
python3 - <<PYEOF
import json, sys

try:
    raw = json.loads('''$RESPONSE''')
    data = raw.get('data', {})

    lines = []

    # 直近セッションサマリー
    latest = data.get('latest_session')
    if latest and latest.get('summary'):
        ended = latest.get('session_ended_at', '')[:10]
        summary_head = latest['summary'].strip().split('\n')[0][:100]
        lines.append(f"【前回セッション ({ended})】{summary_head}")

    # 進行中の Issue
    open_issues = data.get('open_issues', [])
    in_progress = [i for i in open_issues if i.get('status') == 'in_progress']
    if in_progress:
        lines.append(f"【進行中の課題 {len(in_progress)}件】" + " / ".join(
            f"{i['identifier']} {i['title'][:30]}" for i in in_progress[:3]
        ))

    # アクティブプロジェクト
    projects = data.get('active_projects', [])
    if projects:
        lines.append(f"【アクティブプロジェクト {len(projects)}件】" + " / ".join(
            p['name'] for p in projects[:3]
        ))

    if not lines:
        print('{}')
        sys.exit(0)

    context = "\n".join(lines)
    result = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": f"[maestro]\n{context}"
        }
    }
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print('{}')
PYEOF
