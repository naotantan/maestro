#!/usr/bin/env python3
"""
W9 性能テスト / 負荷テスト / ロングランテスト
T07: 各APIエンドポイントの応答速度計測（p50/p95/p99）
T08: 負荷テスト（並列リクエスト・レート制限動作確認）
T09: ロングランテスト（10分継続稼働・応答安定性確認）

実行方法: python3 test_w9_performance.py
"""

import time
import json
import statistics
import subprocess
import os
import sys
import concurrent.futures
import requests
from datetime import datetime

# ===== 設定 =====
BASE_URL = "http://localhost:3000"
API_KEY = "comp_live_326b8b5b68b061302204ed3de5a393788bc48d0c6723d7c2783839b3aab03b50"
AUTH_HEADERS = {"Authorization": f"Bearer {API_KEY}"}
TIMEOUT = 10  # 秒

# テスト結果サマリー保存先
RESULT_JSON = "test_w9_performance_result.json"

# ===== ユーティリティ =====

results = []  # (テストID, テスト名, PASS/FAIL, 詳細)


def measure_latency(url: str, headers: dict = None, method: str = "GET",
                    body: dict = None, n: int = 50) -> dict:
    """n回リクエストしてp50/p95/p99を計測して返す"""
    latencies = []
    errors = 0
    for _ in range(n):
        try:
            start = time.time()
            if method == "GET":
                resp = requests.get(url, headers=headers, timeout=TIMEOUT)
            elif method == "POST":
                resp = requests.post(url, headers=headers, json=body, timeout=TIMEOUT)
            elapsed_ms = (time.time() - start) * 1000
            latencies.append(elapsed_ms)
        except Exception as e:
            errors += 1
    if not latencies:
        return {"p50": None, "p95": None, "p99": None, "min": None, "max": None,
                "avg": None, "errors": errors, "n": n}
    latencies.sort()
    return {
        "p50": latencies[int(len(latencies) * 0.50)],
        "p95": latencies[min(int(len(latencies) * 0.95), len(latencies) - 1)],
        "p99": latencies[min(int(len(latencies) * 0.99), len(latencies) - 1)],
        "min": min(latencies),
        "max": max(latencies),
        "avg": statistics.mean(latencies),
        "errors": errors,
        "n": n,
    }


def report(test_id: str, name: str, passed: bool, detail: str):
    """テスト結果を記録して表示"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  [{test_id}] {status} - {name}: {detail}")
    results.append({
        "id": test_id, "name": name, "passed": passed, "detail": detail
    })


def latency_summary(stats: dict, threshold_ms: float, label: str) -> tuple:
    """latency統計をPASS/FAILに変換"""
    p95 = stats["p95"]
    if p95 is None:
        return False, f"全リクエスト失敗（エラー: {stats['errors']}回）"
    passed = p95 < threshold_ms
    detail = (f"p50={stats['p50']:.1f}ms p95={p95:.1f}ms p99={stats['p99']:.1f}ms "
              f"(目標p95<{threshold_ms}ms) avg={stats['avg']:.1f}ms")
    return passed, detail


# ===== T07: 性能テスト =====

def run_t07():
    print("\n" + "=" * 60)
    print("T07: 性能テスト（応答速度）")
    print("=" * 60)

    # P01: ヘルスチェック
    print("\n[P01] ヘルスチェック応答速度")
    stats = measure_latency(f"{BASE_URL}/health", n=50)
    passed, detail = latency_summary(stats, 100, "P01-01")
    report("P01-01", "GET /health p95 < 100ms", passed, detail)

    # P02: 認証系
    print("\n[P02] 認証系エンドポイント応答速度")
    stats = measure_latency(f"{BASE_URL}/api/agents", headers=AUTH_HEADERS, n=50)
    passed, detail = latency_summary(stats, 300, "P02-01")
    report("P02-01", "GET /api/agents（認証済み）p95 < 300ms", passed, detail)

    stats = measure_latency(f"{BASE_URL}/api/agents", headers={}, n=20)
    passed, detail = latency_summary(stats, 200, "P02-02")
    report("P02-02", "GET /api/agents（認証なし・401）p95 < 200ms", passed, detail)

    # P03: 主要CRUDエンドポイント
    print("\n[P03] 主要CRUDエンドポイント応答速度")
    endpoints = [
        ("P03-01", f"{BASE_URL}/api/agents", "GET /api/agents", 500, 50),
        ("P03-03", f"{BASE_URL}/api/plugins", "GET /api/plugins", 500, 50),
        ("P03-04", f"{BASE_URL}/api/costs", "GET /api/costs", 500, 30),
        ("P03-05", f"{BASE_URL}/api/org", "GET /api/org", 500, 30),
    ]
    for test_id, url, name, threshold, n in endpoints:
        stats = measure_latency(url, headers=AUTH_HEADERS, n=n)
        passed, detail = latency_summary(stats, threshold, test_id)
        report(test_id, f"{name} p95 < {threshold}ms", passed, detail)

    # P03-02: エージェント作成
    ts = int(time.time())
    stats = measure_latency(
        f"{BASE_URL}/api/agents",
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
        method="POST",
        body={"name": f"perf-test-agent-{ts}", "description": "性能テスト用エージェント"},
        n=10,
    )
    passed, detail = latency_summary(stats, 500, "P03-02")
    report("P03-02", "POST /api/agents（エージェント作成）p95 < 500ms", passed, detail)

    # P04: XSSバリデーション速度比較
    print("\n[P04] W9修正 — XSSバリデーション処理速度")
    ts = int(time.time())
    stats_xss = measure_latency(
        f"{BASE_URL}/api/agents",
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
        method="POST",
        body={"name": f"<script>alert(1)</script>-{ts}", "description": "XSSテスト"},
        n=10,
    )
    stats_normal = measure_latency(
        f"{BASE_URL}/api/agents",
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
        method="POST",
        body={"name": f"normal-agent-{ts}", "description": "通常テスト"},
        n=10,
    )
    passed_xss, detail_xss = latency_summary(stats_xss, 500, "P04-01")
    report("P04-01", "XSSペイロード含むPOST p95 < 500ms", passed_xss, detail_xss)
    passed_normal, detail_normal = latency_summary(stats_normal, 500, "P04-02")
    report("P04-02", "通常POST p95 < 500ms", passed_normal, detail_normal)

    # XSSと通常の速度比較
    if stats_xss["p95"] and stats_normal["p95"]:
        ratio = stats_xss["p95"] / stats_normal["p95"] if stats_normal["p95"] > 0 else 0
        passed_ratio = ratio < 2.0  # XSSバリデーションが通常の2倍以内
        report("P04-02b", f"XSS処理が通常の2倍以内（実測: {ratio:.2f}倍）", passed_ratio,
               f"XSS p95={stats_xss['p95']:.1f}ms, 通常 p95={stats_normal['p95']:.1f}ms")

    # P04-03: 無効メールバリデーション速度
    stats = measure_latency(
        f"{BASE_URL}/api/auth/register",
        headers={"Content-Type": "application/json"},
        method="POST",
        body={"email": "@@invalid", "password": "pass", "name": "test"},
        n=10,
    )
    passed, detail = latency_summary(stats, 200, "P04-03")
    report("P04-03", "無効メール拒否（400）p95 < 200ms", passed, detail)

    # P05: エラーレスポンス速度
    print("\n[P05] エラーレスポンス速度")
    stats = measure_latency(f"{BASE_URL}/api/nonexistent-route-xyz",
                             headers=AUTH_HEADERS, n=20)
    passed, detail = latency_summary(stats, 100, "P05-01")
    report("P05-01", "存在しないルート（404 JSON）p95 < 100ms", passed, detail)

    stats = measure_latency(f"{BASE_URL}/api/agents/not-a-valid-uuid",
                             headers=AUTH_HEADERS, n=20)
    passed, detail = latency_summary(stats, 200, "P05-02")
    report("P05-02", "不正UUID（400/404）p95 < 200ms", passed, detail)


# ===== T08: 負荷テスト =====

def run_t08():
    print("\n" + "=" * 60)
    print("T08: 負荷テスト")
    print("=" * 60)

    def single_request(_):
        """単一リクエストを実行してステータスコードを返す"""
        try:
            resp = requests.get(f"{BASE_URL}/api/agents", headers=AUTH_HEADERS, timeout=TIMEOUT)
            return resp.status_code
        except Exception:
            return 0  # 接続エラー

    # L01: 5並列 50件
    print("\n[L01] 軽負荷テスト（5並列 50件）")
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        status_codes = list(executor.map(single_request, range(50)))
    success = sum(1 for s in status_codes if 200 <= s < 300)
    error_5xx = sum(1 for s in status_codes if s >= 500)
    error_rate = error_5xx / len(status_codes) * 100
    passed = success == len(status_codes) and error_5xx == 0
    report("L01", f"5並列50件（全件200系）", passed,
           f"200系={success}/{len(status_codes)}, 5xx={error_5xx}, エラー率={error_rate:.1f}%")

    # L02: 10並列 100件
    print("\n[L02] 中負荷テスト（10並列 100件）")
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        status_codes = list(executor.map(single_request, range(100)))
    success = sum(1 for s in status_codes if 200 <= s < 300)
    error_5xx = sum(1 for s in status_codes if s >= 500)
    error_rate = error_5xx / len(status_codes) * 100
    passed = error_rate < 1.0
    report("L02", f"10並列100件（エラー率<1%）", passed,
           f"200系={success}/{len(status_codes)}, 5xx={error_5xx}, エラー率={error_rate:.1f}%")

    # L03: 認証エンドポイントレート制限テスト
    # /api/auth のレート制限（15分10回）を確認
    print("\n[L03] 認証エンドポイント レート制限テスト（連続12回）")
    rate_limit_hit = False
    statuses = []
    for i in range(12):
        try:
            resp = requests.post(
                f"{BASE_URL}/api/auth/login",
                headers={"Content-Type": "application/json"},
                json={"email": "ratetest@example.com", "password": "wrongpass"},
                timeout=TIMEOUT
            )
            statuses.append(resp.status_code)
            if resp.status_code == 429:
                rate_limit_hit = True
        except Exception:
            statuses.append(0)
    # 10回目まではレスポンスがあること（429が11回目以降に出ること）
    pre_limit = statuses[:10]
    post_limit = statuses[10:]
    # 429が発生、かつクラッシュ(0)がないこと
    no_crash = all(s != 0 for s in statuses)
    report("L03", "認証レート制限（429発動確認）", rate_limit_hit,
           f"ステータス: {statuses} - 429発動={'あり' if rate_limit_hit else 'なし'}")
    report("L03b", "レート制限時もサーバークラッシュなし", no_crash,
           f"全レスポンスがステータスコードあり: {no_crash}")

    # L04: 20並列 一般エンドポイント（クラッシュしないこと）
    print("\n[L04] 並列負荷テスト（20並列 200件）")
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        status_codes = list(executor.map(single_request, range(200)))
    error_5xx = sum(1 for s in status_codes if s >= 500)
    crash = sum(1 for s in status_codes if s == 0)
    error_rate = error_5xx / len(status_codes) * 100
    # 開発環境はRATE_LIMIT_MAX=1000なのでほぼ全て200になるはず
    passed = crash == 0 and error_rate < 1.0
    report("L04", "20並列200件（クラッシュなし・エラー率<1%）", passed,
           f"5xx={error_5xx}, 接続エラー={crash}, エラー率={error_rate:.1f}%")

    # L05: エラー率集計（L01〜L04の合算）
    print("\n[L05] エラー率集計")
    # 既にL01〜L04で確認済みなのでサマリーのみ
    passed_all_load = all(r["passed"] for r in results if r["id"].startswith("L"))
    report("L05", "負荷テスト全体エラー率評価", passed_all_load,
           "L01〜L04の全テスト通過済み" if passed_all_load else "一部テスト失敗あり")


# ===== T09: ロングランテスト =====

def run_t09(duration_minutes: int = 10):
    print("\n" + "=" * 60)
    print(f"T09: ロングランテスト（{duration_minutes}分）")
    print("=" * 60)

    # サーバーPIDを記録
    try:
        result = subprocess.run(["lsof", "-ti:3000"], capture_output=True, text=True)
        start_pid = result.stdout.strip()
    except Exception:
        start_pid = "unknown"
    print(f"\n  開始時 PID: {start_pid}")

    duration_sec = duration_minutes * 60
    interval_sec = 5
    start_time = time.time()
    request_count = 0
    error_count = 0
    latencies_first_half = []
    latencies_second_half = []

    print(f"  {duration_minutes}分間（{duration_sec}秒）の継続テストを開始...")
    print(f"  （{interval_sec}秒間隔でリクエスト継続）")

    while True:
        elapsed = time.time() - start_time
        if elapsed >= duration_sec:
            break

        # 進捗表示（1分ごと）
        if int(elapsed) % 60 == 0 and int(elapsed) > 0:
            print(f"  経過: {int(elapsed / 60)}分 / リクエスト数: {request_count} / エラー: {error_count}")

        try:
            req_start = time.time()
            resp = requests.get(f"{BASE_URL}/api/agents", headers=AUTH_HEADERS, timeout=TIMEOUT)
            latency_ms = (time.time() - req_start) * 1000
            request_count += 1

            if resp.status_code >= 500:
                error_count += 1

            # 前半・後半に分けて記録
            half_point = duration_sec / 2
            if elapsed < half_point:
                latencies_first_half.append(latency_ms)
            else:
                latencies_second_half.append(latency_ms)

        except Exception as e:
            error_count += 1
            request_count += 1

        time.sleep(interval_sec)

    elapsed_total = time.time() - start_time
    print(f"\n  テスト完了: 実施時間={elapsed_total:.1f}秒, リクエスト数={request_count}, エラー数={error_count}")

    # PID確認
    try:
        result = subprocess.run(["lsof", "-ti:3000"], capture_output=True, text=True)
        end_pid = result.stdout.strip()
    except Exception:
        end_pid = "unknown"

    # R01: 継続リクエスト安定性
    error_rate = error_count / request_count * 100 if request_count > 0 else 100
    passed_r01 = error_rate < 1.0
    report("R01", f"10分継続稼働 エラー率<1%（実測: {error_rate:.2f}%）", passed_r01,
           f"リクエスト={request_count}, エラー={error_count}, エラー率={error_rate:.2f}%")

    # R02: 応答時間安定性
    if latencies_first_half and latencies_second_half:
        p95_first = sorted(latencies_first_half)[int(len(latencies_first_half) * 0.95)]
        p95_second = sorted(latencies_second_half)[int(len(latencies_second_half) * 0.95)]
        increase_rate = p95_second / p95_first if p95_first > 0 else 999
        passed_r02 = increase_rate < 1.2
        report("R02", f"応答時間安定性（後半/前半 p95比 < 1.2倍）", passed_r02,
               f"前半p95={p95_first:.1f}ms, 後半p95={p95_second:.1f}ms, 比率={increase_rate:.2f}x")
    else:
        report("R02", "応答時間安定性", False, "データ不足")

    # R03: プロセス継続稼働
    pid_stable = (start_pid == end_pid and start_pid != "" and start_pid != "unknown")
    report("R03", f"プロセス継続稼働（PID変化なし）", pid_stable,
           f"開始PID={start_pid}, 終了PID={end_pid}")


# ===== メイン実行 =====

def main():
    print("=" * 60)
    print("W9 性能テスト / 負荷テスト / ロングランテスト")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"対象: {BASE_URL}")
    print("=" * 60)

    # サーバー疎通確認
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"\n✅ サーバー接続確認: HTTP {resp.status_code}")
    except Exception as e:
        print(f"\n❌ サーバーに接続できません: {e}")
        print("pnpm dev でAPIサーバーを起動してから再実行してください。")
        sys.exit(1)

    # T07実行
    run_t07()

    # T08実行
    run_t08()

    # T09: コマンドライン引数でスキップ可能
    if "--skip-longrun" in sys.argv:
        print("\n⏭️  T09（ロングランテスト）はスキップされました（--skip-longrun）")
    else:
        # デフォルトは10分（--quick オプションで2分に短縮）
        duration = 2 if "--quick" in sys.argv else 10
        if "--quick" in sys.argv:
            print("\n⚡ --quick モード: T09を2分に短縮して実行")
        run_t09(duration_minutes=duration)

    # 結果集計
    print("\n" + "=" * 60)
    print("テスト結果サマリー")
    print("=" * 60)
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    print(f"\n  合計: {total}件 | ✅ PASS: {passed}件 | ❌ FAIL: {failed}件")

    if failed > 0:
        print("\n  ❌ 失敗項目:")
        for r in results:
            if not r["passed"]:
                print(f"    [{r['id']}] {r['name']}: {r['detail']}")

    # JSON結果保存
    output = {
        "timestamp": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "total": total,
        "passed": passed,
        "failed": failed,
        "results": results,
    }
    with open(RESULT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  詳細結果: {RESULT_JSON}")

    print(f"\n  {'✅ 全テスト合格' if failed == 0 else '❌ 一部テスト失敗'}")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
