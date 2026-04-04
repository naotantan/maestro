# セキュリティポリシー / Security Policy

## サポートバージョン / Supported Versions

現在セキュリティアップデートを提供しているバージョンは以下の通りです。

The following versions are currently supported with security updates.

| バージョン / Version | サポート状況 / Supported |
|---|---|
| 0.1.x | ✅ |

---

## 脆弱性の報告 / Reporting a Vulnerability

**セキュリティ上の脆弱性は、公開の GitHub Issues には投稿しないでください。**

**Please do NOT report security vulnerabilities through public GitHub Issues.**

### 報告方法 / How to Report

以下の方法でご報告ください：

Please report using one of the following methods:

1. **GitHub Security Advisories（推奨 / Recommended）**
   - [https://github.com/naotantan/maestro/security/advisories/new](https://github.com/naotantan/maestro/security/advisories/new) から非公開で報告できます
   - You can report privately via the link above

2. **直接連絡 / Direct Contact**
   - リポジトリのメンテナーに GitHub 経由で直接メッセージをお送りください
   - Send a direct message to the repository maintainer via GitHub

### 報告内容に含めてほしい情報 / What to Include

報告時に以下の情報を含めていただくと、迅速な対応が可能になります。

Including the following information helps us triage your report quickly:

- 脆弱性の種類（例：SQL インジェクション、XSS、認証バイパス）
  Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- 脆弱性が存在するファイルのパスとコードの行数
  Full paths of source files related to the vulnerability
- 脆弱性を再現するための手順（可能であれば PoC）
  Step-by-step instructions to reproduce the issue (PoC if possible)
- 影響範囲（どのコンポーネント・バージョン・設定に影響するか）
  Impact of the vulnerability (which components / versions / configurations are affected)

---

## 対応プロセス / Response Process

| ステップ | 期間の目安 |
|---|---|
| 受領確認 / Acknowledgment | 48時間以内 / Within 48 hours |
| 初期評価 / Initial assessment | 5営業日以内 / Within 5 business days |
| 修正リリース / Fix release | 深刻度により異なります / Depends on severity |

報告者には、調査の進捗を随時お知らせします。

We will keep you informed of the investigation progress.

---

## 開示ポリシー / Disclosure Policy

- 修正がリリースされるまで、脆弱性の詳細を公開しないようお願いします
  Please do not disclose vulnerability details until a fix has been released
- 修正リリース後、報告者のご希望に応じてクレジットに記載します
  After the fix is released, we will credit the reporter if they wish
- 悪意のある利用や意図的な悪用は対象外とします
  Malicious exploitation is not covered under this policy

---

## セキュリティ設計について / Security Design

maestro は以下のセキュリティ設計を採用しています：

maestro adopts the following security measures:

- **APIキー認証**: Bearer トークンによる全 API エンドポイントの保護
  **API key authentication**: All API endpoints protected with Bearer tokens
- **マルチテナント分離**: `company_id` による完全なテナント分離
  **Multi-tenant isolation**: Complete tenant isolation via `company_id`
- **暗号化**: エージェント API キーの AES-256-GCM 暗号化保存
  **Encryption**: Agent API keys stored with AES-256-GCM encryption
- **入力バリデーション**: 全エンドポイントでのサニタイズ処理
  **Input validation**: Sanitization across all endpoints
- **SSRF 対策**: Webhook URL のプライベート IP ブロック
  **SSRF protection**: Private IP blocking for webhook URLs
- **レートリミット**: 認証エンドポイントへのレートリミット適用
  **Rate limiting**: Applied to authentication endpoints
