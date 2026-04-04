#!/usr/bin/env python3
"""
migrate-note-articles.py
.company/content/articles/ 配下の Markdown 記事を
maestro PostgreSQL (note_articles テーブル) に移行する。

文字コード: 全ファイルを UTF-8 として読み込む
改行コード: CRLF → LF に正規化してから DB に格納

使い方:
  python3 migrate-note-articles.py [--dry-run]
"""

import os
import sys
import re
import json
import uuid
import argparse
from pathlib import Path
from datetime import datetime, timezone

try:
    import psycopg2
    import yaml
except ImportError:
    print("依存パッケージが不足しています。以下を実行してください:")
    print("  pip3 install psycopg2-binary pyyaml")
    sys.exit(1)

# ── 設定 ──────────────────────────────────────────────────────
ARTICLES_DIR = Path("/Users/naoto/Downloads/.company/content/articles")
DB_DSN       = "postgresql://maestro:changeme@localhost:5432/maestro"

# フォルダ名 → status マッピング
STATUS_MAP = {
    "drafts":    "draft",
    "pipeline":  "pipeline",
    "published": "published",
    "archive":   "archived",
}

# 移行対象外ファイル（管理ファイル）
SKIP_FILES = {"article-master.md", "daily-queue.md", "publish-log.md"}

# ── ユーティリティ ──────────────────────────────────────────────

def normalize_content(raw: str) -> str:
    """CRLF → LF、末尾空白行を除去。encoding は呼び出し元で UTF-8 保証済み。"""
    return raw.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n") + "\n"


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """
    YAML frontmatter を解析して (metadata, body) を返す。
    frontmatter がない場合は ({}, content) を返す。
    """
    if not content.startswith("---\n"):
        return {}, content
    end = content.find("\n---\n", 4)
    if end == -1:
        return {}, content
    yaml_src = content[4:end]
    body     = content[end + 5:]
    try:
        meta = yaml.safe_load(yaml_src) or {}
    except yaml.YAMLError:
        meta = {}
    return meta, body


def extract_title_from_body(body: str) -> str:
    """H1 見出しまたは先頭非空行からタイトルを抽出する。"""
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        # 太字ラベル行（**ステータス**: ... 等）はスキップ
        if line and not line.startswith("**"):
            return line
    return "(無題)"


def to_ts(val) -> datetime | None:
    """文字列または date を datetime に変換する。"""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def collect_articles() -> list[dict]:
    """articles ディレクトリを走査して記事データを収集する。"""
    records = []
    for folder_name, status in STATUS_MAP.items():
        folder = ARTICLES_DIR / folder_name
        if not folder.exists():
            continue
        for path in sorted(folder.glob("*.md")):
            if path.name in SKIP_FILES:
                continue

            # UTF-8 で読み込み、改行コードを LF に正規化
            try:
                raw = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                # BOM 付き UTF-8 もフォールバック
                raw = path.read_text(encoding="utf-8-sig")

            content = normalize_content(raw)
            meta, body = parse_frontmatter(content)

            # タイトル
            title = meta.get("title") or extract_title_from_body(body)
            title = str(title).strip() or "(無題)"

            # タグ: list / string どちらでも受け付ける
            tags_raw = meta.get("tags", [])
            if isinstance(tags_raw, str):
                tags = [t.strip() for t in re.split(r"[\s,]+", tags_raw) if t.strip()]
            elif isinstance(tags_raw, list):
                tags = [str(t).strip() for t in tags_raw if t]
            else:
                tags = []

            # 画像
            images_raw = meta.get("images", [])
            images = images_raw if isinstance(images_raw, list) else []

            # スラッグ = ファイル名から .md を除いたもの
            slug = path.stem

            records.append({
                "slug":               slug,
                "original_filename":  path.name,
                "title":              title,
                "type":               str(meta.get("type", "無料")).strip(),
                "price":              int(meta.get("price", 0)) if meta.get("price") is not None else 0,
                "difficulty":         str(meta.get("difficulty", "")).strip() or None,
                "tags":               tags,
                "images":             images,
                "status":             status,
                "note_url":           str(meta.get("url", "")).strip() or None,
                "content":            content,   # UTF-8 / LF 正規化済み
                "article_created_at": to_ts(meta.get("created")),
                "published_at":       to_ts(meta.get("published")),
                "folder":             folder_name,
            })

    return records


# ── 移行処理 ───────────────────────────────────────────────────

def migrate(dry_run: bool = False):
    articles = collect_articles()
    print(f"対象記事数: {len(articles)} 件")

    # company_id を取得（最初の1件）
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute("SELECT id FROM companies LIMIT 1;")
    row = cur.fetchone()
    if not row:
        print("ERROR: companies テーブルにレコードがありません")
        conn.close()
        sys.exit(1)
    company_id = row[0]
    print(f"company_id: {company_id}")

    if dry_run:
        print("\n[DRY RUN] 以下のレコードが INSERT されます:\n")
        for a in articles:
            print(f"  {a['folder']:<10} {a['slug']:<55} {a['title'][:40]}")
        conn.close()
        return

    # DDL を先に適用（テーブル未作成の場合に備えて）
    ddl_path = Path(__file__).parent.parent / "packages/db/drizzle/0003_note_articles.sql"
    if ddl_path.exists():
        cur.execute(ddl_path.read_text(encoding="utf-8"))
        print("DDL 適用完了")

    inserted = 0
    updated  = 0
    errors   = 0

    for a in articles:
        try:
            cur.execute(
                "SELECT id FROM note_articles WHERE company_id = %s AND slug = %s",
                (company_id, a["slug"]),
            )
            existing = cur.fetchone()

            if existing:
                # UPSERT: 既存レコードを更新
                cur.execute(
                    """
                    UPDATE note_articles SET
                      title               = %s,
                      type                = %s,
                      price               = %s,
                      difficulty          = %s,
                      tags                = %s,
                      images              = %s,
                      status              = %s,
                      note_url            = %s,
                      content             = %s,
                      article_created_at  = %s,
                      published_at        = %s,
                      updated_at          = now()
                    WHERE company_id = %s AND slug = %s
                    """,
                    (
                        a["title"], a["type"], a["price"], a["difficulty"],
                        json.dumps(a["tags"], ensure_ascii=False),
                        json.dumps(a["images"], ensure_ascii=False),
                        a["status"], a["note_url"], a["content"],
                        a["article_created_at"], a["published_at"],
                        company_id, a["slug"],
                    ),
                )
                updated += 1
                print(f"  UPDATE {a['slug']}")
            else:
                cur.execute(
                    """
                    INSERT INTO note_articles
                      (company_id, slug, original_filename, title, type, price,
                       difficulty, tags, images, status, note_url, content,
                       article_created_at, published_at)
                    VALUES
                      (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        company_id, a["slug"], a["original_filename"],
                        a["title"], a["type"], a["price"], a["difficulty"],
                        json.dumps(a["tags"], ensure_ascii=False),
                        json.dumps(a["images"], ensure_ascii=False),
                        a["status"], a["note_url"], a["content"],
                        a["article_created_at"], a["published_at"],
                    ),
                )
                inserted += 1
                print(f"  INSERT {a['slug']}")

        except Exception as e:
            print(f"  ERROR {a['slug']}: {e}")
            errors += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n完了: INSERT {inserted} 件 / UPDATE {updated} 件 / ERROR {errors} 件")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="note記事をmaestro DBに移行する")
    parser.add_argument("--dry-run", action="store_true", help="実際にはDBを変更しない")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
