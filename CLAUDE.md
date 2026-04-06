## 情報の優先順位
- コードとテストが「今の仕様」。ドキュメントより信頼すること。
- コードと仕様書が矛盾する場合は人間に確認すること。
- 仕様書を根拠に実装判断しないこと。必要なドキュメントはプロンプトで指定する。

## 作業記録ルール
実装・修正・設定変更が完了したら、その場で `POST http://localhost:3000/api/issues` に登録すること（status: done）。
セッション終了時にまとめて登録しない。APIキーは `~/.maestro/api-key`。

## 「完了」コマンド
ユーザーが「完了」と入力したら、以下の手順を必ず実行すること。

### ステップ1: 対象Issueの特定
直前の会話コンテキスト（実装・修正した内容）から、対応するmaestro Issueのタイトルと identifierを特定する。
- `GET http://localhost:3000/api/issues` でIssue一覧を取得し、タイトルで照合する
- 複数候補がある場合はユーザーに選択させる

### ステップ2: ユーザー確認
以下の形式で確認を求める：
```
「[MAE-XXX] タイトル」を完了としてよいですか？
```
ユーザーが否定した場合（「いいえ」「違う」「キャンセル」等）は中断する。

### ステップ3: ステータスをdoneに更新
```
PATCH http://localhost:3000/api/issues/:id
Authorization: Bearer <apiKey>
Content-Type: application/json

{ "status": "done" }
```

### ステップ4: 対応内容をコメントとして記録
直前の会話コンテキストを元に、以下の形式で対応内容を要約してコメントに投稿する：
```
POST http://localhost:3000/api/issues/:id/comments
Authorization: Bearer <apiKey>
Content-Type: application/json

{ "body": "## 対応内容\n\n...(要約)..." }
```

**要約に含める内容：**
- 何が問題だったか（原因）
- どう対応したか（変更内容・修正箇所）
- 確認方法・結果

**APIキー:** `~/.maestro/api-key` から読み込む

## 間違いの記録ルール
ユーザーから間違いを指摘されたら、即座にこのファイルの「間違いの記録」セクションに追記すること。

## 間違いの記録
（Claude Codeが間違えるたびにここに追加する）
