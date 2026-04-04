#!/usr/bin/env python3
"""
migrate-note-article-images.py
note記事に紐づく画像ファイルを note_article_images テーブルに移行する。

対象ディレクトリ:
  content/assets/          — サムネイル・ダイアグラム等のアセット
  content/articles/drafts/diagrams/ — draw.io から生成した PNG
  content/articles/drafts/images/  — スクリーンショット等のインライン画像

紐づけロジック:
  1. articles の images フィールドに明示列挙されている → inline
  2. ファイル名に "thumbnail" が含まれる → thumbnail
  3. diagrams/ 配下 → diagram（キーワードマッチで記事を特定）
  4. images/ 配下 → inline（キーワードマッチで記事を特定）
  5. assets/ の日付プレフィクスファイル → date-prefix で記事を特定

使い方:
  python3 migrate-note-article-images.py [--dry-run]
"""

import os
import sys
import json
import argparse
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("依存パッケージが不足しています:")
    print("  pip3 install psycopg2-binary --break-system-packages -q")
    sys.exit(1)

# ── 設定 ──────────────────────────────────────────────────────
BASE_DIR    = Path("/Users/naoto/Downloads/.company/content")
ASSETS_DIR  = BASE_DIR / "assets"
DIAGRAMS_DIR = BASE_DIR / "articles/drafts/diagrams"
IMAGES_DIR  = BASE_DIR / "articles/drafts/images"
DB_DSN      = "host=localhost port=5432 dbname=maestro user=maestro password=changeme"

# diagrams/ ファイル名キーワード → 記事 slug のキーワード
DIAGRAM_KEYWORD_MAP: dict[str, str] = {
    "eval-loop":         "evaluation-loop",
    "hooks-overview":    "hooks-guide",
    "hooks-pretooluse":  "hooks-guide",
    "hooks-session":     "hooks-guide",
}

# images/ ファイル名キーワード → 記事 slug のキーワード
IMAGE_KEYWORD_MAP: dict[str, str] = {
    "maestro-": "maestro-oss-intro",
}


def get_file_size(path: Path) -> int | None:
    try:
        return path.stat().st_size
    except OSError:
        return None


def classify_asset(path: Path, directory: str) -> str:
    """ファイルの image_type を返す。"""
    name = path.name.lower()
    if "thumbnail" in name:
        return "thumbnail"
    if directory == "diagrams":
        return "diagram"
    if directory == "images":
        return "inline"
    return "asset"


def find_article_id_by_slug_keyword(cur, company_id: str, keyword: str) -> str | None:
    """slug に keyword を含む記事の id を返す（最初の1件）。"""
    cur.execute(
        "SELECT id FROM note_articles WHERE company_id = %s AND slug LIKE %s LIMIT 1",
        (company_id, f"%{keyword}%"),
    )
    row = cur.fetchone()
    return row[0] if row else None


def find_article_id_by_date_prefix(cur, company_id: str, date_prefix: str) -> str | None:
    """slug が date_prefix で始まる記事の id を返す（スラッグ名の最長一致優先）。"""
    cur.execute(
        """
        SELECT id FROM note_articles
        WHERE company_id = %s AND slug LIKE %s
        ORDER BY LENGTH(slug) DESC
        LIMIT 1
        """,
        (company_id, f"{date_prefix}%"),
    )
    row = cur.fetchone()
    return row[0] if row else None


def find_article_id_for_image_path(cur, company_id: str, image_path: str) -> str | None:
    """
    frontmatter の images フィールドに image_path が含まれる記事の id を返す。
    images フィールドは JSON 配列（例: ["images/maestro-login.png", ...]）。
    """
    # filename だけで比較（パス区切りの表記が異なる場合に対応）
    filename = Path(image_path).name
    cur.execute(
        """
        SELECT id FROM note_articles
        WHERE company_id = %s
          AND images::text LIKE %s
        LIMIT 1
        """,
        (company_id, f"%{filename}%"),
    )
    row = cur.fetchone()
    return row[0] if row else None


def collect_images(cur, company_id: str) -> list[dict]:
    """3ディレクトリを走査して画像レコードリストを構築する。"""
    records: list[dict] = []

    # ── 1. assets/ ──────────────────────────────────────────
    if ASSETS_DIR.exists():
        for path in sorted(ASSETS_DIR.glob("*.png")):
            image_type = classify_asset(path, "assets")
            article_id: str | None = None

            stem = path.stem  # 例: "2026-04-04-maestro-oss-thumbnail"

            # thumbnail ならスラッグキーワードで探す
            if image_type == "thumbnail":
                # "2026-04-04-maestro-oss-thumbnail" → "maestro-oss"
                keyword = stem.replace("-thumbnail", "").lstrip("0123456789-")
                article_id = find_article_id_by_slug_keyword(cur, company_id, keyword)

            # 日付プレフィクス（YYYY-MM-DD-）があればマッチ
            if article_id is None and len(stem) >= 10 and stem[4] == "-" and stem[7] == "-":
                date_prefix = stem[:10]  # "YYYY-MM-DD"
                slug_keyword = stem[11:] if len(stem) > 10 else ""
                # より具体的なキーワードがあれば使う
                if slug_keyword:
                    article_id = find_article_id_by_slug_keyword(cur, company_id, slug_keyword.replace("-", "_"))
                    if article_id is None:
                        article_id = find_article_id_by_slug_keyword(cur, company_id, slug_keyword)
                if article_id is None:
                    article_id = find_article_id_by_date_prefix(cur, company_id, date_prefix)

            records.append({
                "article_id": article_id,
                "filename":   path.name,
                "file_path":  str(path),
                "image_type": image_type,
                "file_size":  get_file_size(path),
            })

    # ── 2. diagrams/ ──────────────────────────────────────────
    if DIAGRAMS_DIR.exists():
        for path in sorted(DIAGRAMS_DIR.glob("*.png")):
            image_type = "diagram"
            article_id = None

            stem = path.stem  # 例: "eval-loop-before-after"
            for keyword, slug_kw in DIAGRAM_KEYWORD_MAP.items():
                if keyword in stem:
                    article_id = find_article_id_by_slug_keyword(cur, company_id, slug_kw)
                    break

            records.append({
                "article_id": article_id,
                "filename":   path.name,
                "file_path":  str(path),
                "image_type": image_type,
                "file_size":  get_file_size(path),
            })

    # ── 3. images/ ──────────────────────────────────────────
    if IMAGES_DIR.exists():
        for path in sorted(IMAGES_DIR.glob("*.png")):
            image_type = "inline"
            # frontmatter の images フィールドで紐づけ
            rel_path = f"images/{path.name}"  # frontmatter 記載形式と合わせる
            article_id = find_article_id_for_image_path(cur, company_id, rel_path)

            records.append({
                "article_id": article_id,
                "filename":   path.name,
                "file_path":  str(path),
                "image_type": image_type,
                "file_size":  get_file_size(path),
            })

    return records


def migrate(dry_run: bool = False) -> None:
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    # company_id 取得（API キー経由で特定済みの正しい company_id）
    cur.execute(
        "SELECT id FROM companies WHERE id = '6c0ef33d-ea89-4ec0-9e6e-de7424e96376' LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        # フォールバック: 最初の company
        cur.execute("SELECT id FROM companies LIMIT 1")
        row = cur.fetchone()
    if not row:
        print("ERROR: companies テーブルにレコードがありません")
        conn.close()
        sys.exit(1)
    company_id = str(row[0])
    print(f"company_id: {company_id}")

    records = collect_images(cur, company_id)
    print(f"対象画像数: {len(records)} 件")

    if dry_run:
        print("\n[DRY RUN] 登録予定の画像:\n")
        linked = [r for r in records if r["article_id"]]
        unlinked = [r for r in records if not r["article_id"]]
        print(f"  記事紐づきあり: {len(linked)} 件")
        for r in linked:
            print(f"    [{r['image_type']:<9}] {r['filename']}")
        print(f"\n  記事紐づきなし (孤立アセット): {len(unlinked)} 件")
        for r in unlinked:
            print(f"    [{r['image_type']:<9}] {r['filename']}")
        conn.close()
        return

    inserted = 0
    updated  = 0
    errors   = 0

    for rec in records:
        try:
            # 既存チェック（同 company_id + file_path）
            cur.execute(
                "SELECT id FROM note_article_images WHERE company_id = %s AND file_path = %s",
                (company_id, rec["file_path"]),
            )
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    """
                    UPDATE note_article_images SET
                      article_id = %s,
                      filename   = %s,
                      image_type = %s,
                      file_size  = %s
                    WHERE id = %s
                    """,
                    (rec["article_id"], rec["filename"], rec["image_type"], rec["file_size"], existing[0]),
                )
                updated += 1
                print(f"  UPDATE [{rec['image_type']:<9}] {rec['filename']}")
            else:
                cur.execute(
                    """
                    INSERT INTO note_article_images
                      (company_id, article_id, filename, file_path, image_type, file_size)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        company_id, rec["article_id"],
                        rec["filename"], rec["file_path"],
                        rec["image_type"], rec["file_size"],
                    ),
                )
                linked_info = f"→ {rec['article_id'][:8]}..." if rec["article_id"] else "→ (孤立)"
                print(f"  INSERT [{rec['image_type']:<9}] {rec['filename']} {linked_info}")
                inserted += 1

        except Exception as e:
            print(f"  ERROR {rec['filename']}: {e}")
            errors += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n完了: INSERT {inserted} 件 / UPDATE {updated} 件 / ERROR {errors} 件")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="note記事の画像をmaestro DBに移行する")
    parser.add_argument("--dry-run", action="store_true", help="実際にはDBを変更しない")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
