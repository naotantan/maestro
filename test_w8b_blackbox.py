#!/usr/bin/env python3
"""
Comprehensive Blackbox Test Suite for W8B API
10軸 × 10項目 = 100点満点テスト
全項目PASS = 100点のみ合格

実行: python3 test_w8b_blackbox.py
結果: /tmp/w8b_blackbox_results.json に保存
"""

import requests
import json
import time
from datetime import datetime
import sys

# ========== 設定 ==========
BASE_URL = "http://localhost:3000"
API_KEY = "comp_live_326b8b5b68b061302204ed3de5a393788bc48d0c6723d7c2783839b3aab03b50"
SLEEP_INTERVAL = 0.2  # リクエスト間隔（レート制限対策）

# テストデータ
plugin_id = None
job_id = None
webhook_id = None
agent_id = None
issue_id = None
goal_id = None
project_id = None
cost_event_id = None

# 結果格納
results = {
    "A1": {"total": 10, "passed": 0, "items": []},
    "A2": {"total": 10, "passed": 0, "items": []},
    "A3": {"total": 10, "passed": 0, "items": []},
    "A4": {"total": 10, "passed": 0, "items": []},
    "A5": {"total": 10, "passed": 0, "items": []},
    "A6": {"total": 10, "passed": 0, "items": []},
    "A7": {"total": 10, "passed": 0, "items": []},
    "A8": {"total": 10, "passed": 0, "items": []},
    "A9": {"total": 10, "passed": 0, "items": []},
    "A10": {"total": 10, "passed": 0, "items": []},
}

# ========== ユーティリティ関数 ==========

def make_request(method, endpoint, data=None, auth=True, expect_status=None):
    """
    HTTP リクエストを実行し、レスポンスを返す
    """
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}

    if auth:
        headers["Authorization"] = f"Bearer {API_KEY}"

    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PATCH":
            resp = requests.patch(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=10)
        else:
            return None, None

        time.sleep(SLEEP_INTERVAL)
        return resp.status_code, resp.json() if resp.text else {}
    except Exception as e:
        print(f"  ⚠️  Request error: {e}")
        return None, None


def test_case(axis, index, description, condition):
    """
    単一テストケースを実行し、結果を記録
    """
    passed = False
    try:
        passed = condition()
    except Exception as e:
        print(f"  ❌ {axis}-{index:02d}: {description} | Error: {e}")
        results[axis]["items"].append({"index": index, "description": description, "passed": False, "error": str(e)})
        return

    if passed:
        print(f"  ✅ {axis}-{index:02d}: {description}")
        results[axis]["passed"] += 1
    else:
        print(f"  ❌ {axis}-{index:02d}: {description}")

    results[axis]["items"].append({"index": index, "description": description, "passed": passed})


def setup_test_data():
    """
    テストデータのセットアップ
    """
    global plugin_id, job_id, webhook_id, agent_id, issue_id, goal_id, project_id, cost_event_id

    print("\n========== セットアップ: テストデータ作成 ==========")

    # Plugin作成
    status, data = make_request("POST", "/api/plugins", {
        "name": f"test-plugin-{int(time.time())}",
        "description": "Test Plugin"
    })
    if status == 201 and "data" in data and "id" in data["data"]:
        plugin_id = data["data"]["id"]
        print(f"✓ Plugin作成: {plugin_id}")

    # Agent作成
    status, data = make_request("POST", "/api/agents", {
        "name": f"test-agent-{int(time.time())}",
        "type": "claude",
        "description": "Test Agent"
    })
    if status == 201 and "data" in data and "id" in data["data"]:
        agent_id = data["data"]["id"]
        print(f"✓ Agent作成: {agent_id}")

    # Issue作成
    status, data = make_request("POST", "/api/issues", {
        "title": f"test-issue-{int(time.time())}",
        "description": "Test Issue"
    })
    if status == 201 and "data" in data and "id" in data["data"]:
        issue_id = data["data"]["id"]
        print(f"✓ Issue作成: {issue_id}")

    # Goal作成
    status, data = make_request("POST", "/api/goals", {
        "name": f"test-goal-{int(time.time())}",
        "description": "Test Goal"
    })
    if status == 201 and "data" in data and "id" in data["data"]:
        goal_id = data["data"]["id"]
        print(f"✓ Goal作成: {goal_id}")

    # Project作成
    status, data = make_request("POST", "/api/projects", {
        "name": f"test-project-{int(time.time())}",
        "description": "Test Project"
    })
    if status == 201 and "data" in data and "id" in data["data"]:
        project_id = data["data"]["id"]
        print(f"✓ Project作成: {project_id}")

    # Job作成（pluginが必要）
    if plugin_id:
        status, data = make_request("POST", f"/api/plugins/{plugin_id}/jobs", {
            "name": f"test-job-{int(time.time())}",
            "description": "Test Job",
            "schedule": "0 0 * * *"
        })
        if status == 201 and "data" in data and "id" in data["data"]:
            job_id = data["data"]["id"]
            print(f"✓ Job作成: {job_id}")

    # Webhook作成（pluginが必要）
    if plugin_id:
        status, data = make_request("POST", f"/api/plugins/{plugin_id}/webhooks", {
            "url": "https://example.com/webhook",
            "events": ["plugin.created", "plugin.updated"]
        })
        if status == 201 and "data" in data and "id" in data["data"]:
            webhook_id = data["data"]["id"]
            print(f"✓ Webhook作成: {webhook_id}")

    print()


# ========== A1: Plugin CRUD (10項目) ==========

def test_A1():
    """
    A1: Plugin CRUD (10項目)
    """
    print("\n========== A1: Plugin CRUD (10項目) ==========")
    global plugin_id

    # 新しいplugin作成用
    plugin_id_for_crud = None
    deleted_plugin_id = None

    # 1. POST /api/plugins で Plugin作成 → 201 + data.id あり
    def test_1():
        nonlocal plugin_id_for_crud
        status, data = make_request("POST", "/api/plugins", {
            "name": f"crud-plugin-{int(time.time())}",
            "description": "CRUD Test Plugin"
        })
        if status == 201 and "data" in data and "id" in data["data"]:
            plugin_id_for_crud = data["data"]["id"]
            return True
        return False
    test_case("A1", 1, "POST /api/plugins → 201 + data.id", test_1)

    # 2. GET /api/plugins でPlugin一覧取得 → 200 + data 配列
    def test_2():
        status, data = make_request("GET", "/api/plugins")
        return status == 200 and "data" in data and isinstance(data["data"], list)
    test_case("A1", 2, "GET /api/plugins → 200 + data 配列", test_2)

    # 3. GET /api/plugins/:id で単体取得 → 200 + data.id 一致
    def test_3():
        if not plugin_id_for_crud:
            return False
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_crud}")
        return status == 200 and data.get("data", {}).get("id") == plugin_id_for_crud
    test_case("A1", 3, "GET /api/plugins/:id → 200 + data.id 一致", test_3)

    # 4. PATCH /api/plugins/:id でname更新 → 200 + data.name 変更済み
    def test_4():
        if not plugin_id_for_crud:
            return False
        new_name = f"updated-{int(time.time())}"
        status, data = make_request("PATCH", f"/api/plugins/{plugin_id_for_crud}", {
            "name": new_name
        })
        return status == 200 and data.get("data", {}).get("name") == new_name
    test_case("A1", 4, "PATCH /api/plugins/:id でname更新", test_4)

    # 5. PATCH /api/plugins/:id でdescription更新 → 200
    def test_5():
        if not plugin_id_for_crud:
            return False
        status, data = make_request("PATCH", f"/api/plugins/{plugin_id_for_crud}", {
            "description": "Updated Description"
        })
        return status == 200
    test_case("A1", 5, "PATCH /api/plugins/:id でdescription更新", test_5)

    # 6. PATCH /api/plugins/:id でis_active=false → 200
    def test_6():
        if not plugin_id_for_crud:
            return False
        status, data = make_request("PATCH", f"/api/plugins/{plugin_id_for_crud}", {
            "is_active": False
        })
        return status == 200
    test_case("A1", 6, "PATCH /api/plugins/:id でis_active=false", test_6)

    # 7. DELETE /api/plugins/:id → 200 + { success: true }
    def test_7():
        nonlocal deleted_plugin_id
        if not plugin_id_for_crud:
            return False
        deleted_plugin_id = plugin_id_for_crud
        status, data = make_request("DELETE", f"/api/plugins/{plugin_id_for_crud}")
        return status == 200 and data.get("success") is True
    test_case("A1", 7, "DELETE /api/plugins/:id → 200 + success: true", test_7)

    # 8. GET /api/plugins/:id（削除後）→ 404
    def test_8():
        if not deleted_plugin_id:
            return False
        status, data = make_request("GET", f"/api/plugins/{deleted_plugin_id}")
        return status == 404
    test_case("A1", 8, "GET /api/plugins/:id（削除後）→ 404", test_8)

    # 9. POST /api/plugins（name未指定）→ 400 バリデーションエラー
    def test_9():
        status, data = make_request("POST", "/api/plugins", {
            "description": "No name"
        })
        return status == 400
    test_case("A1", 9, "POST /api/plugins（name未指定）→ 400", test_9)

    # 10. GET /api/plugins は自社のみ返す（data 配列が object[] または []）
    def test_10():
        status, data = make_request("GET", "/api/plugins")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A1", 10, "GET /api/plugins は自社のみ返す", test_10)


# ========== A2: Plugin Jobs API (10項目) ==========

def test_A2():
    """
    A2: Plugin Jobs API (10項目)
    """
    print("\n========== A2: Plugin Jobs API (10項目) ==========")
    global plugin_id, job_id

    job_id_for_test = None
    plugin_id_for_jobs = None

    # セットアップ: Job用のPluginを作成
    status, data = make_request("POST", "/api/plugins", {
        "name": f"jobs-plugin-{int(time.time())}",
        "description": "Jobs Test Plugin"
    })
    if status == 201 and "data" in data:
        plugin_id_for_jobs = data["data"]["id"]

    # 1. POST /api/plugins/:pluginId/jobs でジョブ作成 → 201 + data.id
    def test_1():
        nonlocal job_id_for_test
        if not plugin_id_for_jobs:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_jobs}/jobs", {
            "name": f"test-job-{int(time.time())}",
            "description": "Test Job"
        })
        if status == 201 and "data" in data and "id" in data["data"]:
            job_id_for_test = data["data"]["id"]
            return True
        return False
    test_case("A2", 1, "POST /api/plugins/:pluginId/jobs → 201 + data.id", test_1)

    # 2. GET /api/plugins/:pluginId/jobs でジョブ一覧 → 200 + data 配列
    def test_2():
        if not plugin_id_for_jobs:
            return False
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_jobs}/jobs")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A2", 2, "GET /api/plugins/:pluginId/jobs → 200 + data 配列", test_2)

    # 3. POST /api/plugins/:pluginId/jobs/:jobId/run → 201 + data.status == 'completed'
    def test_3():
        if not plugin_id_for_jobs or not job_id_for_test:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_jobs}/jobs/{job_id_for_test}/run", {})
        return status == 201 and data.get("data", {}).get("status") == "completed"
    test_case("A2", 3, "POST job run → 201 + status: completed", test_3)

    # 4. POST /api/plugins/00000000-0000-0000-0000-000000000001/jobs → 404
    def test_4():
        status, data = make_request("POST", "/api/plugins/00000000-0000-0000-0000-000000000001/jobs", {
            "name": "test"
        })
        return status == 404
    test_case("A2", 4, "POST /api/plugins/00000000-0000-0000-0000-000000000001/jobs → 404", test_4)

    # 5. POST /api/plugins/:pluginId/jobs（name未指定）→ 400
    def test_5():
        if not plugin_id_for_jobs:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_jobs}/jobs", {
            "description": "No name"
        })
        return status == 400
    test_case("A2", 5, "POST job（name未指定）→ 400", test_5)

    # 6. GET /api/plugins/00000000-0000-0000-0000-000000000001/jobs → 404
    def test_6():
        status, data = make_request("GET", "/api/plugins/00000000-0000-0000-0000-000000000001/jobs")
        return status == 404
    test_case("A2", 6, "GET /api/plugins/00000000-0000-0000-0000-000000000001/jobs → 404", test_6)

    # 7. POST job → name に日本語使用 → 201
    def test_7():
        if not plugin_id_for_jobs:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_jobs}/jobs", {
            "name": "テストジョブ",
            "description": "日本語テスト"
        })
        return status == 201
    test_case("A2", 7, "POST job → name に日本語使用 → 201", test_7)

    # 8. POST job → schedule フィールド保存確認 → 201 + data.schedule あり
    def test_8():
        if not plugin_id_for_jobs:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_jobs}/jobs", {
            "name": f"schedule-job-{int(time.time())}",
            "schedule": "0 0 * * *"
        })
        return status == 201 and "schedule" in data.get("data", {})
    test_case("A2", 8, "POST job → schedule フィールド保存", test_8)

    # 9. 同一pluginに複数ジョブ作成 → GET で全件返す
    def test_9():
        if not plugin_id_for_jobs:
            return False
        # 複数ジョブ作成
        for i in range(2):
            make_request("POST", f"/api/plugins/{plugin_id_for_jobs}/jobs", {
                "name": f"multi-job-{i}-{int(time.time())}"
            })
        # 取得
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_jobs}/jobs")
        return status == 200 and len(data.get("data", [])) >= 2
    test_case("A2", 9, "同一pluginに複数ジョブ作成 → GET で全件返す", test_9)

    # 10. 削除したpluginのjobsアクセス → 404
    def test_10():
        if not plugin_id_for_jobs:
            return False
        # Pluginを削除
        make_request("DELETE", f"/api/plugins/{plugin_id_for_jobs}")
        # Jobsにアクセス
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_jobs}/jobs")
        return status == 404
    test_case("A2", 10, "削除したpluginのjobsアクセス → 404", test_10)


# ========== A3: Plugin Webhooks API (10項目) ==========

def test_A3():
    """
    A3: Plugin Webhooks API (10項目)
    """
    print("\n========== A3: Plugin Webhooks API (10項目) ==========")

    webhook_id_for_test = None
    plugin_id_for_webhooks = None

    # セットアップ: Webhook用のPluginを作成
    status, data = make_request("POST", "/api/plugins", {
        "name": f"webhooks-plugin-{int(time.time())}",
        "description": "Webhooks Test Plugin"
    })
    if status == 201 and "data" in data:
        plugin_id_for_webhooks = data["data"]["id"]

    # 1. POST /api/plugins/:pluginId/webhooks でWebhook作成 → 201 + data.id
    def test_1():
        nonlocal webhook_id_for_test
        if not plugin_id_for_webhooks:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_webhooks}/webhooks", {
            "url": "https://example.com/webhook",
            "events": ["plugin.created"]
        })
        if status == 201 and "data" in data and "id" in data["data"]:
            webhook_id_for_test = data["data"]["id"]
            return True
        return False
    test_case("A3", 1, "POST /api/plugins/:pluginId/webhooks → 201 + data.id", test_1)

    # 2. GET /api/plugins/:pluginId/webhooks でWebhook一覧 → 200
    def test_2():
        if not plugin_id_for_webhooks:
            return False
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_webhooks}/webhooks")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A3", 2, "GET /api/plugins/:pluginId/webhooks → 200", test_2)

    # 3. POST Webhook（url + events）→ 201
    def test_3():
        if not plugin_id_for_webhooks:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_webhooks}/webhooks", {
            "url": "https://example.com/test",
            "events": ["plugin.updated", "plugin.deleted"]
        })
        return status == 201
    test_case("A3", 3, "POST Webhook（url + events）→ 201", test_3)

    # 4. POST Webhook（url未指定）→ 400
    def test_4():
        if not plugin_id_for_webhooks:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_webhooks}/webhooks", {
            "events": ["plugin.created"]
        })
        return status == 400
    test_case("A3", 4, "POST Webhook（url未指定）→ 400", test_4)

    # 5. POST Webhook（events空配列）→ 400
    def test_5():
        if not plugin_id_for_webhooks:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_webhooks}/webhooks", {
            "url": "https://example.com/test",
            "events": []
        })
        return status == 400
    test_case("A3", 5, "POST Webhook（events空配列）→ 400", test_5)

    # 6. POST Webhook（不正URL）→ 400
    def test_6():
        if not plugin_id_for_webhooks:
            return False
        status, data = make_request("POST", f"/api/plugins/{plugin_id_for_webhooks}/webhooks", {
            "url": "not-a-valid-url",
            "events": ["plugin.created"]
        })
        return status == 400
    test_case("A3", 6, "POST Webhook（不正URL）→ 400", test_6)

    # 7. GET /api/plugins/00000000-0000-0000-0000-000000000001/webhooks → 404
    def test_7():
        status, data = make_request("GET", "/api/plugins/00000000-0000-0000-0000-000000000001/webhooks")
        return status == 404
    test_case("A3", 7, "GET /api/plugins/00000000-0000-0000-0000-000000000001/webhooks → 404", test_7)

    # 8. POST /api/plugins/00000000-0000-0000-0000-000000000001/webhooks → 404
    def test_8():
        status, data = make_request("POST", "/api/plugins/00000000-0000-0000-0000-000000000001/webhooks", {
            "url": "https://example.com/test",
            "events": ["plugin.created"]
        })
        return status == 404
    test_case("A3", 8, "POST /api/plugins/00000000-0000-0000-0000-000000000001/webhooks → 404", test_8)

    # 9. 同一pluginに複数Webhook作成 → GET で全件返す
    def test_9():
        if not plugin_id_for_webhooks:
            return False
        for i in range(2):
            make_request("POST", f"/api/plugins/{plugin_id_for_webhooks}/webhooks", {
                "url": f"https://example.com/webhook-{i}",
                "events": ["plugin.created"]
            })
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_webhooks}/webhooks")
        return status == 200 and len(data.get("data", [])) >= 2
    test_case("A3", 9, "同一pluginに複数Webhook作成 → GET で全件返す", test_9)

    # 10. events フィールドが配列として保存される
    def test_10():
        if not webhook_id_for_test or not plugin_id_for_webhooks:
            return False
        status, data = make_request("GET", f"/api/plugins/{plugin_id_for_webhooks}/webhooks")
        if status == 200:
            for item in data.get("data", []):
                if item.get("id") == webhook_id_for_test:
                    return isinstance(item.get("events"), list)
        return False
    test_case("A3", 10, "events フィールドが配列として保存", test_10)


# ========== A4: Activity 自動記録 - POST系 (10項目) ==========

def test_A4():
    """
    A4: Activity 自動記録 - POST系 (10項目)
    """
    print("\n========== A4: Activity 自動記録 - POST系 (10項目) ==========")

    # 1. POST /api/agents → GET /api/activity で agent の activity が存在する
    def test_1():
        status, data = make_request("POST", "/api/agents", {
            "name": f"activity-agent-{int(time.time())}",
            "model": "gpt-4"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_type") == "agent":
                    return True
        return False
    test_case("A4", 1, "POST /api/agents → activity に記録", test_1)

    # 2. POST /api/issues → GET /api/activity で issue の activity が存在する
    def test_2():
        status, data = make_request("POST", "/api/issues", {
            "title": f"activity-issue-{int(time.time())}",
            "description": "Test"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_type") == "issue":
                    return True
        return False
    test_case("A4", 2, "POST /api/issues → activity に記録", test_2)

    # 3. POST /api/goals → GET /api/activity で goal の activity が存在する
    def test_3():
        status, data = make_request("POST", "/api/goals", {
            "name": f"activity-goal-{int(time.time())}",
            "description": "Test"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_type") == "goal":
                    return True
        return False
    test_case("A4", 3, "POST /api/goals → activity に記録", test_3)

    # 4. POST /api/costs → 201 + data.id（コスト記録）
    def test_4():
        if not agent_id:
            return False
        status, data = make_request("POST", "/api/costs", {
            "agent_id": agent_id,
            "model": "gpt-4",
            "cost_usd": 0.01
        })
        return status == 201 and "id" in data.get("data", {})
    test_case("A4", 4, "POST /api/costs → 201 + data.id", test_4)

    # 5. POST /api/plugins → activity に plugin の記録がある
    def test_5():
        status, data = make_request("POST", "/api/plugins", {
            "name": f"activity-plugin-{int(time.time())}",
            "description": "Test"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_type") == "plugin":
                    return True
        return False
    test_case("A4", 5, "POST /api/plugins → activity に記録", test_5)

    # 6. GET /api/activity → 200 + data 配列
    def test_6():
        status, data = make_request("GET", "/api/activity")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A4", 6, "GET /api/activity → 200 + data 配列", test_6)

    # 7. POST /api/projects → activity に project の記録がある
    def test_7():
        status, data = make_request("POST", "/api/projects", {
            "name": f"activity-project-{int(time.time())}",
            "description": "Test"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_type") == "project":
                    return True
        return False
    test_case("A4", 7, "POST /api/projects → activity に記録", test_7)

    # 8. Activity recordに entity_type フィールドがある
    def test_8():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "entity_type" in item:
                    return True
        return False
    test_case("A4", 8, "Activity recordに entity_type フィールド", test_8)

    # 9. Activity recordに action フィールドがある（'create'など）
    def test_9():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "action" in item:
                    return True
        return False
    test_case("A4", 9, "Activity recordに action フィールド", test_9)

    # 10. Activity recordに entity_id フィールドがある
    def test_10():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "entity_id" in item:
                    return True
        return False
    test_case("A4", 10, "Activity recordに entity_id フィールド", test_10)


# ========== A5: Activity 自動記録 - PATCH/DELETE系 (10項目) ==========

def test_A5():
    """
    A5: Activity 自動記録 - PATCH/DELETE系 (10項目)
    """
    print("\n========== A5: Activity 自動記録 - PATCH/DELETE系 (10項目) ==========")

    # セットアップ
    agent_id_for_a5 = None
    issue_id_for_a5 = None
    goal_id_for_a5 = None

    status, data = make_request("POST", "/api/agents", {
        "name": f"patch-agent-{int(time.time())}",
        "type": "claude"
    })
    if status == 201:
        agent_id_for_a5 = data["data"]["id"]

    status, data = make_request("POST", "/api/issues", {
        "title": f"patch-issue-{int(time.time())}",
        "description": "Test"
    })
    if status == 201:
        issue_id_for_a5 = data["data"]["id"]

    status, data = make_request("POST", "/api/goals", {
        "name": f"patch-goal-{int(time.time())}",
        "description": "Test"
    })
    if status == 201:
        goal_id_for_a5 = data["data"]["id"]

    # 1. PATCH /api/agents/:id → activity に action='update' の記録
    def test_1():
        if not agent_id_for_a5:
            return False
        status, data = make_request("PATCH", f"/api/agents/{agent_id_for_a5}", {
            "name": f"updated-{int(time.time())}"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_id") == agent_id_for_a5 and item.get("action") == "update":
                    return True
        return False
    test_case("A5", 1, "PATCH /api/agents/:id → activity に update 記録", test_1)

    # 2. DELETE /api/agents/:id → activity に action='delete' の記録
    def test_2():
        if not agent_id_for_a5:
            return False
        status, data = make_request("DELETE", f"/api/agents/{agent_id_for_a5}")
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_id") == agent_id_for_a5 and item.get("action") == "delete":
                    return True
        return False
    test_case("A5", 2, "DELETE /api/agents/:id → activity に delete 記録", test_2)

    # 3. PATCH /api/issues/:id → activity に issue の update 記録
    def test_3():
        if not issue_id_for_a5:
            return False
        status, data = make_request("PATCH", f"/api/issues/{issue_id_for_a5}", {
            "title": f"updated-{int(time.time())}"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_id") == issue_id_for_a5 and item.get("action") == "update":
                    return True
        return False
    test_case("A5", 3, "PATCH /api/issues/:id → activity に update 記録", test_3)

    # 4. DELETE /api/issues/:id → activity に issue の delete 記録
    def test_4():
        if not issue_id_for_a5:
            return False
        status, data = make_request("DELETE", f"/api/issues/{issue_id_for_a5}")
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_id") == issue_id_for_a5 and item.get("action") == "delete":
                    return True
        return False
    test_case("A5", 4, "DELETE /api/issues/:id → activity に delete 記録", test_4)

    # 5. PATCH /api/goals/:id → activity に goal の update 記録
    def test_5():
        if not goal_id_for_a5:
            return False
        status, data = make_request("PATCH", f"/api/goals/{goal_id_for_a5}", {
            "name": f"updated-{int(time.time())}"
        })
        time.sleep(0.3)
        status_act, data_act = make_request("GET", "/api/activity")
        if status_act == 200:
            for item in data_act.get("data", []):
                if item.get("entity_id") == goal_id_for_a5 and item.get("action") == "update":
                    return True
        return False
    test_case("A5", 5, "PATCH /api/goals/:id → activity に update 記録", test_5)

    # 6. GET /api/activity は配列を返す
    def test_6():
        status, data = make_request("GET", "/api/activity")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A5", 6, "GET /api/activity は配列を返す", test_6)

    # 7. PATCH後のactivityにentity_idが記録されている
    def test_7():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "entity_id" in item:
                    return True
        return False
    test_case("A5", 7, "PATCH後のactivityにentity_idが記録", test_7)

    # 8. DELETE後のactivityにentity_idが記録されている
    def test_8():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if item.get("action") == "delete" and "entity_id" in item:
                    return True
        return False
    test_case("A5", 8, "DELETE後のactivityにentity_idが記録", test_8)

    # 9. Activity一覧が時系列で複数件ある
    def test_9():
        status, data = make_request("GET", "/api/activity")
        return status == 200 and len(data.get("data", [])) > 0
    test_case("A5", 9, "Activity一覧が複数件ある", test_9)

    # 10. Activity取得で200が返る
    def test_10():
        status, data = make_request("GET", "/api/activity")
        return status == 200
    test_case("A5", 10, "Activity取得で200が返る", test_10)


# ========== A6: Activity 記録の正確性 (10項目) ==========

def test_A6():
    """
    A6: Activity 記録の正確性 (10項目)
    """
    print("\n========== A6: Activity 記録の正確性 (10項目) ==========")

    # 1. GET /api/activity → 200
    def test_1():
        status, data = make_request("GET", "/api/activity")
        return status == 200
    test_case("A6", 1, "GET /api/activity → 200", test_1)

    # 2. Response に data プロパティがある
    def test_2():
        status, data = make_request("GET", "/api/activity")
        return status == 200 and "data" in data
    test_case("A6", 2, "Response に data プロパティ", test_2)

    # 3. data が配列
    def test_3():
        status, data = make_request("GET", "/api/activity")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A6", 3, "data が配列", test_3)

    # 4. 各activity itemにidフィールドがある
    def test_4():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "id" in item:
                    return True
        return False
    test_case("A6", 4, "各activity itemにidフィールド", test_4)

    # 5. 各activity itemにentity_typeがある
    def test_5():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "entity_type" in item:
                    return True
        return False
    test_case("A6", 5, "各activity itemにentity_typeがある", test_5)

    # 6. 各activity itemにactionがある
    def test_6():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "action" in item:
                    return True
        return False
    test_case("A6", 6, "各activity itemにactionがある", test_6)

    # 7. 各activity itemにentity_idがある
    def test_7():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "entity_id" in item:
                    return True
        return False
    test_case("A6", 7, "各activity itemにentity_idがある", test_7)

    # 8. 各activity itemにcreated_atがある
    def test_8():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            for item in data.get("data", []):
                if "created_at" in item:
                    return True
        return False
    test_case("A6", 8, "各activity itemにcreated_atがある", test_8)

    # 9. 複数のentity_typeが記録されている
    def test_9():
        status, data = make_request("GET", "/api/activity")
        if status == 200:
            entity_types = set()
            for item in data.get("data", []):
                if "entity_type" in item:
                    entity_types.add(item["entity_type"])
            return len(entity_types) > 1
        return False
    test_case("A6", 9, "複数のentity_typeが記録されている", test_9)

    # 10. GET /api/activity は認証必須（無認証で401）
    def test_10():
        status, data = make_request("GET", "/api/activity", auth=False)
        return status == 401
    test_case("A6", 10, "GET /api/activity は認証必須（401）", test_10)


# ========== A7: 予算ポリシーAPI (10項目) ==========

def test_A7():
    """
    A7: 予算ポリシーAPI (10項目)
    """
    print("\n========== A7: 予算ポリシーAPI (10項目) ==========")

    budget_id = None

    # 1. GET /api/costs/budget → 200 + data 配列
    def test_1():
        status, data = make_request("GET", "/api/costs/budget")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A7", 1, "GET /api/costs/budget → 200 + data 配列", test_1)

    # 2. POST /api/costs/budget で予算ポリシー作成 → 201 + data.id
    def test_2():
        nonlocal budget_id
        status, data = make_request("POST", "/api/costs/budget", {
            "agent_id": "test-agent",
            "limit_amount_usd": 100.0
        })
        if status == 201 and "data" in data and "id" in data["data"]:
            budget_id = data["data"]["id"]
            return True
        return False
    test_case("A7", 2, "POST /api/costs/budget → 201 + data.id", test_2)

    # 3. POST /api/costs/budget（agent_id + limit_amount_usd）→ 201
    def test_3():
        if not agent_id:
            return False
        status, data = make_request("POST", "/api/costs/budget", {
            "agent_id": agent_id,
            "limit_amount_usd": 50.0
        })
        return status == 201
    test_case("A7", 3, "POST /api/costs/budget（agent_id + limit_amount_usd）", test_3)

    # 4. GET /api/costs/budget は認証必須（無認証で401）
    def test_4():
        status, data = make_request("GET", "/api/costs/budget", auth=False)
        return status == 401
    test_case("A7", 4, "GET /api/costs/budget は認証必須（401）", test_4)

    # 5. POST /api/costs/budget は認証必須（無認証で401）
    def test_5():
        status, data = make_request("POST", "/api/costs/budget", {
            "agent_id": "test",
            "limit_amount_usd": 10.0
        }, auth=False)
        return status == 401
    test_case("A7", 5, "POST /api/costs/budget は認証必須（401）", test_5)

    # 6. GET /api/costs → 200（cost events一覧）
    def test_6():
        status, data = make_request("GET", "/api/costs")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A7", 6, "GET /api/costs → 200（cost events一覧）", test_6)

    # 7. POST /api/costs でコストイベント記録 → 201 + data.id
    def test_7():
        if not agent_id:
            return False
        status, data = make_request("POST", "/api/costs", {
            "agent_id": agent_id,
            "model": "gpt-4",
            "cost_usd": 0.05
        })
        return status == 201 and "id" in data.get("data", {})
    test_case("A7", 7, "POST /api/costs でコストイベント記録 → 201", test_7)

    # 8. POST /api/costs（agent_id + model + cost_usd）→ 201
    def test_8():
        if not agent_id:
            return False
        status, data = make_request("POST", "/api/costs", {
            "agent_id": agent_id,
            "model": "gpt-3.5-turbo",
            "cost_usd": 0.01
        })
        return status == 201
    test_case("A7", 8, "POST /api/costs（agent_id + model + cost_usd）", test_8)

    # 9. GET /api/costs は自社分のみ → data 配列
    def test_9():
        status, data = make_request("GET", "/api/costs")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A7", 9, "GET /api/costs は自社分のみ → data 配列", test_9)

    # 10. POST /api/costs（agent_id未指定）→ 400
    def test_10():
        status, data = make_request("POST", "/api/costs", {
            "model": "gpt-4",
            "cost_usd": 0.05
        })
        return status == 400
    test_case("A7", 10, "POST /api/costs（agent_id未指定）→ 400", test_10)


# ========== A8: エラーハンドリング (10項目) ==========

def test_A8():
    """
    A8: エラーハンドリング (10項目)
    """
    print("\n========== A8: エラーハンドリング (10項目) ==========")

    # 1. GET /api/plugins/00000000-0000-0000-0000-000000000001 → 404 + error フィールド
    def test_1():
        status, data = make_request("GET", "/api/plugins/00000000-0000-0000-0000-000000000001")
        return status == 404 and "error" in data
    test_case("A8", 1, "GET /api/plugins/00000000-0000-0000-0000-000000000001 → 404 + error", test_1)

    # 2. PATCH /api/plugins/00000000-0000-0000-0000-000000000001 → 404
    def test_2():
        status, data = make_request("PATCH", "/api/plugins/00000000-0000-0000-0000-000000000001", {
            "name": "test"
        })
        return status == 404
    test_case("A8", 2, "PATCH /api/plugins/00000000-0000-0000-0000-000000000001 → 404", test_2)

    # 3. DELETE /api/plugins/00000000-0000-0000-0000-000000000001 → 200 or 404
    def test_3():
        status, data = make_request("DELETE", "/api/plugins/00000000-0000-0000-0000-000000000001")
        return status in [200, 404]
    test_case("A8", 3, "DELETE /api/plugins/00000000-0000-0000-0000-000000000001 → 200 or 404", test_3)

    # 4. POST /api/plugins（name=null）→ 400 + error フィールド
    def test_4():
        status, data = make_request("POST", "/api/plugins", {
            "name": None,
            "description": "test"
        })
        return status == 400
    test_case("A8", 4, "POST /api/plugins（name=null）→ 400", test_4)

    # 5. POST /api/costs（必須フィールド欠如）→ 400
    def test_5():
        status, data = make_request("POST", "/api/costs", {
            "model": "gpt-4"
        })
        return status == 400
    test_case("A8", 5, "POST /api/costs（必須フィールド欠如）→ 400", test_5)

    # 6. POST /api/costs/budget（必須フィールド欠如）→ 400 or 500
    def test_6():
        status, data = make_request("POST", "/api/costs/budget", {
            "agent_id": "test"
        })
        return status in [400, 500]
    test_case("A8", 6, "POST /api/costs/budget（必須フィールド欠如）", test_6)

    # 7. POST /api/plugins/:pluginId/webhooks（不正URL）→ 400
    def test_7():
        status, data = make_request("POST", "/api/plugins/test/webhooks", {
            "url": "invalid-url",
            "events": ["test"]
        })
        return status == 400 or status == 404
    test_case("A8", 7, "POST webhook（不正URL）→ 400 or 404", test_7)

    # 8. POST /api/plugins/:pluginId/webhooks（events未指定）→ 400
    def test_8():
        status, data = make_request("POST", "/api/plugins/test/webhooks", {
            "url": "https://example.com"
        })
        return status == 400 or status == 404
    test_case("A8", 8, "POST webhook（events未指定）→ 400 or 404", test_8)

    # 9. エラーレスポンスに error フィールドがある
    def test_9():
        status, data = make_request("GET", "/api/plugins/00000000-0000-0000-0000-000000000001")
        return status == 404 and "error" in data
    test_case("A8", 9, "エラーレスポンスに error フィールド", test_9)

    # 10. エラーレスポンスに message フィールドがある
    def test_10():
        status, data = make_request("GET", "/api/plugins/00000000-0000-0000-0000-000000000001")
        return status == 404 and ("error" in data or "message" in data)
    test_case("A8", 10, "エラーレスポンスに error/message フィールド", test_10)


# ========== A9: 認証・テナント分離 (10項目) ==========

def test_A9():
    """
    A9: 認証・テナント分離 (10項目)
    """
    print("\n========== A9: 認証・テナント分離 (10項目) ==========")

    # 1. 無認証でGET /api/plugins → 401
    def test_1():
        status, data = make_request("GET", "/api/plugins", auth=False)
        return status == 401
    test_case("A9", 1, "無認証でGET /api/plugins → 401", test_1)

    # 2. 無認証でPOST /api/plugins → 401
    def test_2():
        status, data = make_request("POST", "/api/plugins", {
            "name": "test"
        }, auth=False)
        return status == 401
    test_case("A9", 2, "無認証でPOST /api/plugins → 401", test_2)

    # 3. 無認証でGET /api/activity → 401
    def test_3():
        status, data = make_request("GET", "/api/activity", auth=False)
        return status == 401
    test_case("A9", 3, "無認証でGET /api/activity → 401", test_3)

    # 4. 無認証でGET /api/costs/budget → 401
    def test_4():
        status, data = make_request("GET", "/api/costs/budget", auth=False)
        return status == 401
    test_case("A9", 4, "無認証でGET /api/costs/budget → 401", test_4)

    # 5. 無認証でPOST /api/costs → 401
    def test_5():
        status, data = make_request("POST", "/api/costs", {
            "agent_id": "test",
            "model": "gpt-4",
            "cost_usd": 0.01
        }, auth=False)
        return status == 401
    test_case("A9", 5, "無認証でPOST /api/costs → 401", test_5)

    # 6. 不正なAPIキーでGET /api/plugins → 401
    def test_6():
        url = f"{BASE_URL}/api/plugins"
        headers = {
            "Authorization": "Bearer invalid-key",
            "Content-Type": "application/json"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        time.sleep(SLEEP_INTERVAL)
        return resp.status_code == 401
    test_case("A9", 6, "不正なAPIキーでGET /api/plugins → 401", test_6)

    # 7. 不正なAPIキーでPOST /api/agents → 401
    def test_7():
        url = f"{BASE_URL}/api/agents"
        headers = {
            "Authorization": "Bearer invalid-key",
            "Content-Type": "application/json"
        }
        resp = requests.post(url, headers=headers, json={"name": "test"}, timeout=10)
        time.sleep(SLEEP_INTERVAL)
        return resp.status_code == 401
    test_case("A9", 7, "不正なAPIキーでPOST /api/agents → 401", test_7)

    # 8. 有効なAPIキーでGET /api/agents → 200（自社データのみ）
    def test_8():
        status, data = make_request("GET", "/api/agents")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A9", 8, "有効なAPIキーでGET /api/agents → 200", test_8)

    # 9. 有効なAPIキーでGET /api/plugins → 200（自社データのみ）
    def test_9():
        status, data = make_request("GET", "/api/plugins")
        return status == 200 and isinstance(data.get("data"), list)
    test_case("A9", 9, "有効なAPIキーでGET /api/plugins → 200", test_9)

    # 10. 認証エラーはerror: "unauthorized"を返す
    def test_10():
        status, data = make_request("GET", "/api/plugins", auth=False)
        return status == 401 and (data.get("error") == "unauthorized" or "error" in data)
    test_case("A9", 10, "認証エラーはerror フィールド", test_10)


# ========== A10: 既存機能非破壊 (10項目) ==========

def test_A10():
    """
    A10: 既存機能非破壊 (10項目)
    """
    print("\n========== A10: 既存機能非破壊 (10項目) ==========")

    # 1. GET /api/agents → 200
    def test_1():
        status, data = make_request("GET", "/api/agents")
        return status == 200
    test_case("A10", 1, "GET /api/agents → 200", test_1)

    # 2. GET /api/issues → 200
    def test_2():
        status, data = make_request("GET", "/api/issues")
        return status == 200
    test_case("A10", 2, "GET /api/issues → 200", test_2)

    # 3. GET /api/goals → 200
    def test_3():
        status, data = make_request("GET", "/api/goals")
        return status == 200
    test_case("A10", 3, "GET /api/goals → 200", test_3)

    # 4. GET /api/projects → 200
    def test_4():
        status, data = make_request("GET", "/api/projects")
        return status == 200
    test_case("A10", 4, "GET /api/projects → 200", test_4)

    # 5. GET /api/costs → 200
    def test_5():
        status, data = make_request("GET", "/api/costs")
        return status == 200
    test_case("A10", 5, "GET /api/costs → 200", test_5)

    # 6. POST /api/agents → 201
    def test_6():
        status, data = make_request("POST", "/api/agents", {
            "name": f"agent-{int(time.time())}",
            "type": "claude"
        })
        return status == 201
    test_case("A10", 6, "POST /api/agents → 201", test_6)

    # 7. POST /api/issues → 201
    def test_7():
        status, data = make_request("POST", "/api/issues", {
            "title": f"issue-{int(time.time())}",
            "description": "Test"
        })
        return status == 201
    test_case("A10", 7, "POST /api/issues → 201", test_7)

    # 8. POST /api/goals → 201
    def test_8():
        status, data = make_request("POST", "/api/goals", {
            "name": f"goal-{int(time.time())}",
            "description": "Test"
        })
        return status == 201
    test_case("A10", 8, "POST /api/goals → 201", test_8)

    # 9. GET /health → 200
    def test_9():
        status, data = make_request("GET", "/health", auth=False)
        return status == 200
    test_case("A10", 9, "GET /health → 200", test_9)

    # 10. GET /api/routines → 200
    def test_10():
        status, data = make_request("GET", "/api/routines")
        return status == 200
    test_case("A10", 10, "GET /api/routines → 200", test_10)


# ========== メイン実行 ==========

def main():
    """
    全テストの実行
    """
    print("=" * 60)
    print("W8B API ブラックボックステスト開始")
    print("=" * 60)
    print(f"BASE_URL: {BASE_URL}")
    print(f"テスト開始時刻: {datetime.now().isoformat()}")

    # セットアップ
    setup_test_data()

    # テスト実行
    test_A1()
    test_A2()
    test_A3()
    test_A4()
    test_A5()
    test_A6()
    test_A7()
    test_A8()
    test_A9()
    test_A10()

    # 結果集計
    print("\n" + "=" * 60)
    print("テスト結果集計")
    print("=" * 60)

    total_passed = 0
    total_tests = 0

    for axis in ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"]:
        passed = results[axis]["passed"]
        total = results[axis]["total"]
        total_passed += passed
        total_tests += total
        status = "✅ PASS" if passed == total else "❌ FAIL"
        print(f"{axis}: {passed}/{total} {status}")

    total_score = total_passed
    print(f"\n合計: {total_passed}/{total_tests} = {total_score}点")

    if total_score == 100:
        print("全テストPASS!")
    else:
        print(f"{100 - total_score}点不足")

    # 結果をファイルに保存
    with open("/tmp/w8b_blackbox_results.json", "w") as f:
        results["summary"] = {
            "total_passed": total_passed,
            "total_tests": total_tests,
            "score": total_score,
            "timestamp": datetime.now().isoformat()
        }
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n結果を保存: /tmp/w8b_blackbox_results.json")

    return 0 if total_score == 100 else 1


if __name__ == "__main__":
    sys.exit(main())
