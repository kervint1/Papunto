# CLAUDE.md

このリポジトリで作業する際の指示。

## 禁止事項

- `.env` ファイルを読み込まない。シークレット（`GOOGLE_CLIENT_SECRET`、`SECRET_KEY`、`NEXTAUTH_SECRET`、`MONLIX_POSTBACK_SECRET`等）が含まれるため、内容を表示・引用・送信しない。設定内容を確認する必要がある場合は `.env.example` を参照するか、ユーザーに直接確認する。

## 構成

- `web/` — Next.js（フロントエンド）
- `server/` — FastAPI（バックエンド）
- `docs/requirements/` — 要件・設計ドキュメント（00〜07番）。技術選定や仕様を確認する際はまずここを参照する
