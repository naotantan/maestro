#!/bin/bash

# company-cli API ブラックボックステスト
# 軸1: API完全性、軸2: 認証・セキュリティ

set -e

BASE_URL="http://localhost:3000"
OUTPUT_FILE="/tmp/api_test_results.txt"
TEMP_DIR="/tmp/company_api_test"

mkdir -p "$TEMP_DIR"
> "$OUTPUT_FILE"

echo "===============================================" | tee -a "$OUTPUT_FILE"
echo "COMPANY-CLI API BLACKBOX TEST" | tee -a "$OUTPUT_FILE"
echo "$(date)" | tee -a "$OUTPUT_FILE"
echo "===============================================" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# ================== STEP 1: ユーザー登録 ==================
echo "STEP 1: ユーザー登録" | tee -a "$OUTPUT_FILE"
echo "------" | tee -a "$OUTPUT_FILE"

REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestUser_'$(date +%s)'",
    "email": "test_'$(date +%s)'@example.com",
    "password": "TestPass123!",
    "companyName": "TestCompany_'$(date +%s)'"
  }')

echo "Response: $REGISTER_RESPONSE" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# APIキーを抽出
APIKEY=$(echo "$REGISTER_RESPONSE" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4 || echo "")
USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1 || echo "")

if [ -z "$APIKEY" ]; then
  echo "ERROR: Failed to get API key" | tee -a "$OUTPUT_FILE"
  exit 1
fi

echo "Got API Key: ${APIKEY:0:20}..." | tee -a "$OUTPUT_FILE"
echo "Got User ID: $USER_ID" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# ================== STEP 2: 軸1 - API完全性テスト ==================
echo "STEP 2: 軸1 - API完全性テスト" | tee -a "$OUTPUT_FILE"
echo "======================================" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# テスト結果を保存する
test_count=0
pass_count=0

test_endpoint() {
  local num=$1
  local method=$2
  local endpoint=$3
  local expected_code=$4
  local body=$5
  local description=$6

  test_count=$((test_count + 1))

  local url="${BASE_URL}${endpoint}"
  local response_file="$TEMP_DIR/response_${num}.txt"
  local status_code

  if [ -z "$body" ]; then
    status_code=$(curl -s -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $APIKEY" \
      -H "Content-Type: application/json" \
      -o "$response_file")
  else
    status_code=$(curl -s -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $APIKEY" \
      -H "Content-Type: application/json" \
      -d "$body" \
      -o "$response_file")
  fi

  echo "[$num] $method $endpoint" | tee -a "$OUTPUT_FILE"
  echo "Expected: $expected_code, Got: $status_code" | tee -a "$OUTPUT_FILE"

  if [ "$status_code" = "$expected_code" ]; then
    echo "Result: ✅ PASS" | tee -a "$OUTPUT_FILE"
    pass_count=$((pass_count + 1))
  else
    echo "Result: ❌ FAIL" | tee -a "$OUTPUT_FILE"
    echo "Response (first 200 chars):" | tee -a "$OUTPUT_FILE"
    head -c 200 "$response_file" | tee -a "$OUTPUT_FILE"
  fi
  echo "" | tee -a "$OUTPUT_FILE"
}

# 1. GET /health
test_endpoint 1 "GET" "/health" "200"

# 2. GET /api/companies
test_endpoint 2 "GET" "/api/companies" "200"

# 3. POST /api/agents - エージェント作成
AGENT_BODY='{"name":"TestAgent","type":"worker"}'
test_endpoint 3 "POST" "/api/agents" "201" "$AGENT_BODY"

# レスポンスからエージェントIDを抽出
AGENT_ID=$(cat "$TEMP_DIR/response_3.txt" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1 || echo "")
if [ -z "$AGENT_ID" ]; then
  AGENT_ID="dummy-agent-id"
fi
echo "Extracted Agent ID: $AGENT_ID" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# 4. GET /api/agents - エージェント一覧
test_endpoint 4 "GET" "/api/agents" "200"

# 5. GET /api/agents/:id - エージェント詳細
test_endpoint 5 "GET" "/api/agents/$AGENT_ID" "200"

# 6. PATCH /api/agents/:id - エージェント更新
AGENT_UPDATE='{"name":"UpdatedAgent"}'
test_endpoint 6 "PATCH" "/api/agents/$AGENT_ID" "200" "$AGENT_UPDATE"

# 7. POST /api/agents/:id/heartbeat - ハートビート
HEARTBEAT_BODY='{"status":"running","taskName":"TestTask"}'
test_endpoint 7 "POST" "/api/agents/$AGENT_ID/heartbeat" "200" "$HEARTBEAT_BODY"

# 8. GET /api/agents/:id/runs - 実行履歴
test_endpoint 8 "GET" "/api/agents/$AGENT_ID/runs" "200"

# 9. POST /api/issues - Issue作成
ISSUE_BODY='{"title":"Test Issue","description":"Test Description","priority":"high"}'
test_endpoint 9 "POST" "/api/issues" "201" "$ISSUE_BODY"

ISSUE_ID=$(cat "$TEMP_DIR/response_9.txt" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1 || echo "")
if [ -z "$ISSUE_ID" ]; then
  ISSUE_ID="dummy-issue-id"
fi
echo "Extracted Issue ID: $ISSUE_ID" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# 10. GET /api/issues - Issue一覧
test_endpoint 10 "GET" "/api/issues" "200"

# 11. GET /api/issues/:id - Issue詳細
test_endpoint 11 "GET" "/api/issues/$ISSUE_ID" "200"

# 12. PATCH /api/issues/:id - Issue更新
ISSUE_UPDATE='{"status":"done"}'
test_endpoint 12 "PATCH" "/api/issues/$ISSUE_ID" "200" "$ISSUE_UPDATE"

# 13. POST /api/issues/:id/comments - コメント追加
COMMENT_BODY='{"text":"Test comment"}'
test_endpoint 13 "POST" "/api/issues/$ISSUE_ID/comments" "201" "$COMMENT_BODY"

# 14. GET /api/issues/:id/comments - コメント一覧
test_endpoint 14 "GET" "/api/issues/$ISSUE_ID/comments" "200"

# 15. POST /api/goals - Goal作成
GOAL_BODY='{"title":"Test Goal","description":"Test Goal Desc"}'
test_endpoint 15 "POST" "/api/goals" "201" "$GOAL_BODY"

GOAL_ID=$(cat "$TEMP_DIR/response_15.txt" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1 || echo "")
if [ -z "$GOAL_ID" ]; then
  GOAL_ID="dummy-goal-id"
fi
echo "Extracted Goal ID: $GOAL_ID" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# 16. GET /api/goals - Goal一覧
test_endpoint 16 "GET" "/api/goals" "200"

# 17. GET /api/goals/:id - Goal詳細
test_endpoint 17 "GET" "/api/goals/$GOAL_ID" "200"

# 18. PATCH /api/goals/:id - Goal更新
GOAL_UPDATE='{"title":"Updated Goal"}'
test_endpoint 18 "PATCH" "/api/goals/$GOAL_ID" "200" "$GOAL_UPDATE"

# 19. POST /api/goals/:id/recalculate - 達成率計算
test_endpoint 19 "POST" "/api/goals/$GOAL_ID/recalculate" "200"

# 20. POST /api/issues/:id/goals - Issue↔Goal紐付け
LINK_BODY='{"goalId":"'$GOAL_ID'"}'
test_endpoint 20 "POST" "/api/issues/$ISSUE_ID/goals" "201" "$LINK_BODY"

# 21. GET /api/issues/:id/goals - Issue紐付きGoal
test_endpoint 21 "GET" "/api/issues/$ISSUE_ID/goals" "200"

# 22. DELETE /api/issues/:id/goals/:goalId - 紐付け解除
test_endpoint 22 "DELETE" "/api/issues/$ISSUE_ID/goals/$GOAL_ID" "204"

# 23. GET /api/projects - Project一覧
test_endpoint 23 "GET" "/api/projects" "200"

# 24. POST /api/projects - Project作成
PROJECT_BODY='{"name":"TestProject","description":"Test"}'
test_endpoint 24 "POST" "/api/projects" "201" "$PROJECT_BODY"

# 25. GET /api/routines - Routine一覧
test_endpoint 25 "GET" "/api/routines" "200"

# 26. POST /api/routines - Routine作成
ROUTINE_BODY='{"name":"TestRoutine","description":"Test"}'
test_endpoint 26 "POST" "/api/routines" "201" "$ROUTINE_BODY"

# 27. GET /api/costs - Cost一覧
test_endpoint 27 "GET" "/api/costs" "200"

# 28. GET /api/approvals - Approval一覧
test_endpoint 28 "GET" "/api/approvals" "200"

# 29. GET /api/plugins - Plugin一覧
test_endpoint 29 "GET" "/api/plugins" "200"

# 30. GET /api/activity - Activity一覧
test_endpoint 30 "GET" "/api/activity" "200"

# 31. GET /api/org - Org情報
test_endpoint 31 "GET" "/api/org" "200"

# 32. DELETE /api/issues/:id - Issue削除
test_endpoint 32 "DELETE" "/api/issues/$ISSUE_ID" "204"

# 33. DELETE /api/agents/:id - エージェント削除
test_endpoint 33 "DELETE" "/api/agents/$AGENT_ID" "204"

# 34. DELETE /api/goals/:id - Goal削除
test_endpoint 34 "DELETE" "/api/goals/$GOAL_ID" "204"

echo "" | tee -a "$OUTPUT_FILE"
echo "=============== API完全性テスト結果 ===============" | tee -a "$OUTPUT_FILE"
echo "Passed: $pass_count / $test_count" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# ================== STEP 3: 軸2 - 認証・セキュリティテスト ==================
echo "STEP 3: 軸2 - 認証・セキュリティテスト" | tee -a "$OUTPUT_FILE"
echo "======================================" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

sec_count=0
sec_pass=0

test_security() {
  local num=$1
  local test_name=$2
  local method=$3
  local endpoint=$4
  local expected_code=$5
  local body=$6
  local headers=$7

  sec_count=$((sec_count + 1))

  local url="${BASE_URL}${endpoint}"
  local response_file="$TEMP_DIR/sec_response_${num}.txt"
  local status_code

  # ヘッダー処理（カスタムヘッダー指定用）
  local curl_cmd="curl -s -w \"%{http_code}\" -X \"$method\" \"$url\""

  if [ ! -z "$headers" ]; then
    # カスタムヘッダーを使用
    curl_cmd="$curl_cmd $headers"
  else
    # デフォルトヘッダー（APIキーなし）
    curl_cmd="$curl_cmd -H \"Content-Type: application/json\""
  fi

  if [ ! -z "$body" ]; then
    curl_cmd="$curl_cmd -d '$body'"
  fi

  curl_cmd="$curl_cmd -o \"$response_file\""
  status_code=$(eval "$curl_cmd")

  echo "[$num] $test_name" | tee -a "$OUTPUT_FILE"
  echo "Expected Status: $expected_code, Got: $status_code" | tee -a "$OUTPUT_FILE"

  if [ "$status_code" = "$expected_code" ]; then
    echo "Result: ✅ PASS" | tee -a "$OUTPUT_FILE"
    sec_pass=$((sec_pass + 1))
  else
    echo "Result: ❌ FAIL" | tee -a "$OUTPUT_FILE"
    echo "Response:" | tee -a "$OUTPUT_FILE"
    head -c 200 "$response_file" | tee -a "$OUTPUT_FILE"
  fi
  echo "" | tee -a "$OUTPUT_FILE"
}

# 1. 無効APIキーで401
test_security 1 "Invalid API Key -> 401" "GET" "/api/companies" "401" "" \
  "-H \"Authorization: Bearer invalid_key_12345\" -H \"Content-Type: application/json\""

# 2. 空のAPIキーで401
test_security 2 "Empty API Key -> 401" "GET" "/api/companies" "401" "" \
  "-H \"Content-Type: application/json\""

# 3. XSSペイロード テスト
XSS_PAYLOAD='{"title":"<script>alert(1)</script>","description":"XSS Test"}'
test_security 3 "XSS Payload" "POST" "/api/issues" "201" "$XSS_PAYLOAD" \
  "-H \"Authorization: Bearer $APIKEY\" -H \"Content-Type: application/json\""

# 確認: レスポンスに<script>が含まれていないか
XSS_RESPONSE=$(cat "$TEMP_DIR/sec_response_3.txt")
if echo "$XSS_RESPONSE" | grep -q "<script>" || echo "$XSS_RESPONSE" | grep -q "alert"; then
  echo "⚠️  XSS vulnerability detected - response contains <script> or alert" | tee -a "$OUTPUT_FILE"
  XSS_SAFE=0
else
  echo "✅ XSS appears to be sanitized" | tee -a "$OUTPUT_FILE"
  XSS_SAFE=1
fi
echo "" | tee -a "$OUTPUT_FILE"

# 4. SQLインジェクション テスト
SQL_PAYLOAD='{"title":"Test\"; DROP TABLE issues; --","description":"SQL Injection Test"}'
test_security 4 "SQL Injection Attempt" "POST" "/api/issues" "201" "$SQL_PAYLOAD" \
  "-H \"Authorization: Bearer $APIKEY\" -H \"Content-Type: application/json\""

echo "Checking if database is still intact..." | tee -a "$OUTPUT_FILE"
INTEGRITY_CHECK=$(curl -s -H "Authorization: Bearer $APIKEY" "$BASE_URL/api/issues" | grep -c "issues" || echo "0")
if [ "$INTEGRITY_CHECK" != "0" ]; then
  echo "✅ Database appears intact - SQL injection prevented" | tee -a "$OUTPUT_FILE"
else
  echo "⚠️  Unable to verify - possible SQL injection" | tee -a "$OUTPUT_FILE"
fi
echo "" | tee -a "$OUTPUT_FILE"

# 5. 他社リソースアクセス制限テスト（別ユーザーで検証）
echo "Testing cross-company access control..." | tee -a "$OUTPUT_FILE"
REGISTER_RESPONSE_2=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestUser2_'$(date +%s)'",
    "email": "test2_'$(date +%s)'@example.com",
    "password": "TestPass123!"
  }')

APIKEY_2=$(echo "$REGISTER_RESPONSE_2" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4 || echo "")

if [ ! -z "$APIKEY_2" ]; then
  # User1のリソースをUser2のキーでアクセス
  CROSS_ACCESS=$(curl -s -w "%{http_code}" \
    -H "Authorization: Bearer $APIKEY_2" \
    "$BASE_URL/api/agents/$AGENT_ID" -o /dev/null)

  echo "User2 accessing User1's Agent ID: $CROSS_ACCESS" | tee -a "$OUTPUT_FILE"

  # 403 Forbidden か 404 Not Found が期待される
  if [ "$CROSS_ACCESS" = "403" ] || [ "$CROSS_ACCESS" = "404" ]; then
    echo "✅ Cross-company access denied" | tee -a "$OUTPUT_FILE"
    sec_pass=$((sec_pass + 1))
  else
    echo "⚠️  Warning: Unexpected status $CROSS_ACCESS" | tee -a "$OUTPUT_FILE"
  fi
else
  echo "⚠️  Could not create second user for cross-access test" | tee -a "$OUTPUT_FILE"
fi
sec_count=$((sec_count + 1))
echo "" | tee -a "$OUTPUT_FILE"

echo "=============== セキュリティテスト結果 ===============" | tee -a "$OUTPUT_FILE"
echo "Passed: $sec_pass / $sec_count" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# ================== サマリー ==================
echo "=============== 最終サマリー ===============" | tee -a "$OUTPUT_FILE"
echo "軸1: API完全性: $pass_count / $test_count PASS" | tee -a "$OUTPUT_FILE"
echo "軸2: 認証・セキュリティ: $sec_pass / $sec_count PASS" | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"
echo "Test completed at $(date)" | tee -a "$OUTPUT_FILE"

# 結果ファイルを表示
cat "$OUTPUT_FILE"
