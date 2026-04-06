#!/usr/bin/env python3
"""
sync-skills-to-local.py
maestro の plugins テーブルにあるスキルを
ローカルの Claude Code スキルディレクトリに同期する。

maestro に登録済みで、ローカルにファイルがないスキルを新規作成する。
既存スキルは description のみ更新（本文は上書きしない）。

対象ディレクトリ（デフォルト）:
  ~/.claude/skills/
  /Users/naoto/ai-dev/.claude/skills/

使い方:
  python3 sync-skills-to-local.py [--dry-run] [--api-url URL] [--api-key KEY]
  python3 sync-skills-to-local.py --target ~/.claude/skills/  # 一方だけ同期
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# ── 設定 ──────────────────────────────────────────────────────
DEFAULT_API_URL  = "http://localhost:3000"
API_KEY_FILE     = Path.home() / ".maestro" / "api-key"

# 同期先ディレクトリ（複数対応）
DEFAULT_TARGETS = [
    Path.home() / ".claude" / "skills",
    Path("/Users/naoto/ai-dev/.claude/skills"),
]

# maestro由来スキルのマーカー（frontmatterに付ける）
ORIGIN_MARKER = "maestro"


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


def fetch_plugins(api_url: str, api_key: str) -> list[dict]:
    """maestro から plugins 一覧を取得する。"""
    req = urllib.request.Request(
        f"{api_url}/api/plugins",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("data", [])
    except urllib.error.URLError as e:
        print(f"ERROR: maestro API に接続できません — {e}")
        sys.exit(1)


def make_skill_md(name: str, description: str) -> str:
    """SKILL.md のテンプレートを生成する。"""
    # descriptionのクオートをエスケープ
    desc_safe = description.replace('"', "'")
    return f"""---
name: {name}
description: {desc_safe}
origin: {ORIGIN_MARKER}
---

# {name}

{description}

> このスキルは maestro からインポートされました。
> 詳細な手順・ルールは maestro の plugins 画面を参照してください。
"""


def sync_to_target(
    plugins: list[dict],
    target_dir: Path,
    dry_run: bool,
) -> tuple[int, int, int]:
    """
    target_dir にスキルを同期する。
    戻り値: (created, updated, skipped)
    """
    created = updated = skipped = 0

    if not target_dir.exists():
        if dry_run:
            print(f"  [DRY RUN] {target_dir} を作成（スキップ）")
        else:
            target_dir.mkdir(parents=True, exist_ok=True)

    for plugin in plugins:
        name: str = plugin.get("name", "").strip()
        description: str = plugin.get("description") or ""
        if not name:
            skipped += 1
            continue

        skill_dir  = target_dir / name
        skill_file = skill_dir / "SKILL.md"

        if skill_file.exists():
            # 既存: frontmatter の description だけ更新する
            content = skill_file.read_text(encoding="utf-8")
            if "origin: maestro" not in content:
                # 手書きスキル（origin が maestro でない）は上書きしない
                skipped += 1
                continue

            # description 行を置換
            lines = content.splitlines(keepends=True)
            new_lines = []
            for line in lines:
                if line.startswith("description:"):
                    desc_safe = description.replace('"', "'")
                    new_lines.append(f"description: {desc_safe}\n")
                else:
                    new_lines.append(line)
            new_content = "".join(new_lines)

            if new_content != content:
                if not dry_run:
                    skill_file.write_text(new_content, encoding="utf-8")
                updated += 1
            else:
                skipped += 1
        else:
            # 新規作成
            if dry_run:
                print(f"  [DRY RUN] CREATE {skill_dir}")
            else:
                skill_dir.mkdir(parents=True, exist_ok=True)
                skill_file.write_text(make_skill_md(name, description), encoding="utf-8")
            created += 1

    return created, updated, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="maestro のスキルをローカル Claude Code に同期する")
    parser.add_argument("--dry-run",  action="store_true", help="ファイルを変更しない")
    parser.add_argument("--api-url",  default=DEFAULT_API_URL)
    parser.add_argument("--api-key",  default=None)
    parser.add_argument("--target",   action="append", dest="targets",
                        help="同期先ディレクトリ（複数指定可）。省略時はデフォルト2か所")
    args = parser.parse_args()

    api_key = get_api_key(args.api_key)
    targets = [Path(t) for t in args.targets] if args.targets else DEFAULT_TARGETS

    # maestro からスキル一覧取得
    plugins = fetch_plugins(args.api_url, api_key)
    print(f"maestro から {len(plugins)} 件取得")

    total_created = total_updated = total_skipped = 0

    for target_dir in targets:
        print(f"\n--- {target_dir} ---")
        c, u, s = sync_to_target(plugins, target_dir, args.dry_run)
        print(f"  CREATE {c} / UPDATE {u} / SKIP {s}")
        total_created += c
        total_updated += u
        total_skipped += s

    print(f"\n合計: CREATE {total_created} / UPDATE {total_updated} / SKIP {total_skipped}")


if __name__ == "__main__":
    main()
