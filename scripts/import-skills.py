#!/usr/bin/env python3
"""
import-skills.py
Claude Code のスキルを maestro にバルクインポートする。

読み込み元:
  1. ~/.claude/skills/         — スキルディレクトリ（SKILL.md に frontmatter）
  2. ~/.claude/plugins/        — プラグインスキル（同形式）
  3. .company/CLAUDE.md        — スキルテーブル（| /name | 部署 | 用途 | 形式）

使い方:
  python3 import-skills.py [--dry-run] [--api-url URL] [--api-key KEY]
"""

import os
import sys
import re
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# ── 設定 ──────────────────────────────────────────────────────
SKILLS_DIR   = Path.home() / ".claude" / "skills"
PLUGINS_DIR  = Path.home() / ".claude" / "plugins"
COMPANY_MD   = Path("/Users/naoto/Downloads/.company/CLAUDE.md")
API_KEY_FILE = Path.home() / ".maestro" / "api-key"

DEFAULT_API_URL = "http://localhost:3000"


def get_api_key(cli_key: str | None) -> str:
    if cli_key:
        return cli_key
    if API_KEY_FILE.exists():
        return API_KEY_FILE.read_text().strip()
    key = os.environ.get("MAESTRO_API_KEY", "")
    if not key:
        print("ERROR: APIキーが見つかりません。~/.maestro/api-key または --api-key を指定してください")
        sys.exit(1)
    return key


def parse_frontmatter(content: str) -> dict:
    """YAML frontmatter（--- で囲まれた部分）を辞書として返す。"""
    if not content.startswith("---"):
        return {}
    end = content.find("\n---", 3)
    if end == -1:
        return {}
    fm_text = content[3:end].strip()
    result: dict = {}
    for line in fm_text.splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            result[key.strip()] = val.strip()
    return result


def collect_from_skill_dirs() -> list[dict]:
    """~/.claude/skills/ と ~/.claude/plugins/ をスキャンする。"""
    records: list[dict] = []
    for base_dir in [SKILLS_DIR, PLUGINS_DIR]:
        if not base_dir.exists():
            continue
        for entry in sorted(base_dir.iterdir()):
            # ディレクトリ形式: <name>/SKILL.md
            if entry.is_dir():
                skill_md = entry / "SKILL.md"
                if not skill_md.exists():
                    continue
                content = skill_md.read_text(encoding="utf-8", errors="replace")
                fm = parse_frontmatter(content)
                name = fm.get("name") or entry.name
                description = fm.get("description") or ""
                # descriptionが長い場合は最初の200文字
                if len(description) > 200:
                    description = description[:197] + "..."
                records.append({
                    "name": name,
                    "description": description,
                    "source_path": str(skill_md),
                })
            # ファイル形式: <name>.md
            elif entry.suffix in (".md", ""):
                content = entry.read_text(encoding="utf-8", errors="replace")
                fm = parse_frontmatter(content)
                name = fm.get("name") or entry.stem
                description = fm.get("description") or ""
                if len(description) > 200:
                    description = description[:197] + "..."
                records.append({
                    "name": name,
                    "description": description,
                    "source_path": str(entry),
                })
    return records


def collect_from_company_md() -> list[dict]:
    """.company/CLAUDE.md のスキルテーブルをパースする。
    期待フォーマット: | /skill-name | 担当部署 | 用途 |
    """
    if not COMPANY_MD.exists():
        return []

    records: list[dict] = []
    content = COMPANY_MD.read_text(encoding="utf-8", errors="replace")

    # スキルテーブルの行を探す（| /xxx | ... | ... | 形式）
    pattern = re.compile(r"^\|\s*(/[\w\-]+)\s*\|\s*([^|]*)\|\s*([^|]*)\|", re.MULTILINE)
    for m in pattern.finditer(content):
        name = m.group(1).strip().lstrip("/")  # "/company" → "company"
        dept = m.group(2).strip()
        purpose = m.group(3).strip()
        description = f"{purpose}（担当: {dept}）" if dept else purpose
        records.append({
            "name": name,
            "description": description[:200],
            "source_path": str(COMPANY_MD),
        })
    return records


def deduplicate(records: list[dict]) -> list[dict]:
    """name の小文字で重複を排除（最初に登場したものを優先）。"""
    seen: set[str] = set()
    result: list[dict] = []
    for r in records:
        key = r["name"].lower()
        if key not in seen:
            seen.add(key)
            result.append(r)
    return result


def bulk_import(skills: list[dict], api_url: str, api_key: str, dry_run: bool) -> None:
    if dry_run:
        print(f"\n[DRY RUN] インポート予定: {len(skills)} 件\n")
        for s in skills[:20]:
            desc_preview = (s["description"] or "")[:60]
            print(f"  {s['name']:<35} {desc_preview}")
        if len(skills) > 20:
            print(f"  ... 他 {len(skills) - 20} 件")
        return

    # 500件ずつバッチ送信
    batch_size = 500
    total_inserted = total_updated = total_skipped = 0
    total_errors: list = []

    for i in range(0, len(skills), batch_size):
        batch = skills[i:i + batch_size]
        payload = json.dumps({"skills": batch}).encode("utf-8")
        req = urllib.request.Request(
            f"{api_url}/api/plugins/bulk",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                d = result.get("data", {})
                total_inserted += d.get("inserted", 0)
                total_updated  += d.get("updated", 0)
                total_skipped  += d.get("skipped", 0)
                total_errors   += d.get("errors", [])
                print(f"  バッチ {i // batch_size + 1}: INSERT {d.get('inserted',0)} / UPDATE {d.get('updated',0)}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"  ERROR バッチ {i // batch_size + 1}: HTTP {e.code} — {body[:200]}")
            sys.exit(1)

    print(f"\n完了: INSERT {total_inserted} / UPDATE {total_updated} / SKIP {total_skipped} / ERROR {len(total_errors)}")
    if total_errors:
        print("エラー一覧:")
        for e in total_errors[:10]:
            print(f"  {e.get('name')}: {e.get('reason')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Claude Code スキルを maestro にバルクインポートする")
    parser.add_argument("--dry-run",  action="store_true", help="DBを変更せず確認のみ")
    parser.add_argument("--api-url",  default=DEFAULT_API_URL, help=f"maestro API URL（デフォルト: {DEFAULT_API_URL}）")
    parser.add_argument("--api-key",  default=None, help="Bearer トークン（省略時は ~/.maestro/api-key）")
    parser.add_argument("--source",   choices=["all", "skills", "company"], default="all",
                        help="読み込み元: all（デフォルト）/ skills（~/.claude/skills のみ）/ company（CLAUDE.mdのみ）")
    args = parser.parse_args()

    api_key = get_api_key(args.api_key)

    # スキル収集
    records: list[dict] = []
    if args.source in ("all", "skills"):
        skill_records = collect_from_skill_dirs()
        print(f"~/.claude/skills/ + plugins/ から {len(skill_records)} 件取得")
        records.extend(skill_records)
    if args.source in ("all", "company"):
        company_records = collect_from_company_md()
        print(f".company/CLAUDE.md から {len(company_records)} 件取得")
        records.extend(company_records)

    # 重複排除
    records = deduplicate(records)
    print(f"重複排除後: {len(records)} 件")

    bulk_import(records, args.api_url, api_key, args.dry_run)


if __name__ == "__main__":
    main()
