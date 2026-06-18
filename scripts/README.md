# Scripts

開発・運用で使用するスクリプト群です。

## コマンド一覧

### データベース (db)

```bash
# マイグレーション生成
pnpm db:generate

# スキーマをDBに反映
pnpm db:push

# シーダー実行（インタラクティブ）
pnpm db:seed

# 全シーダー実行
pnpm db:seed:all

# データ削除（インタラクティブ）
pnpm db:clear

# 全データ削除
pnpm db:clear:all

# DB構築 + 全シード（初期セットアップ）
pnpm db:setup
```

詳細: [db/seed/README.md](./db/seed/README.md)

### ドメイン設定 (dc)

```bash
# domain.json テンプレート作成
pnpm dc:init -- <Domain>

# ファイル生成
pnpm dc:generate -- <Domain>

# 全ドメイン生成（ファイル選択）
pnpm dc:generate:all

# ドメイン削除
pnpm dc:delete -- <Domain>

# フィールド追加
pnpm dc:add -- <Domain>
```

### メール (mail)

```bash
# テストメール送信
pnpm mail:test

# カラーパレット生成
pnpm mail:generate-colors
```

### Claude API

```bash
# API接続確認
pnpm claude:test
```

事前設定: `.env.development` に `ANTHROPIC_API_KEY` を設定

### Storage (CORS)

```bash
# Firebase Storage バケットに CORS を設定(origin は "*")
pnpm storage:setup-cors

# origin を実ドメインに限定(本番推奨)
pnpm storage:setup-cors https://your-app.com https://www.your-app.com
```

用途: 別ドメインの Storage バイトをブラウザで読む全機能(MSE / `fetch()` / `<video crossOrigin>`→canvas / Web Audio)の共通基盤前提。バケット単位・一度きりの設定。判定ルール・トラブルシュート・前提(権限/env)は一次情報に集約:

➡ [Storage の CORS 設定（リモートメディア読み取りの基盤前提）](../docs/how-to/initial-setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md)

事前設定: `MY_SERVICE_ACCOUNT_KEY`(storage.buckets.update 権限) と `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

## ディレクトリ構成

```
scripts/
├── README.md              # このファイル
├── test-claude-api.ts     # Claude API 接続確認
├── db/                    # データベース関連
│   ├── seed/              # シーダー
│   └── clear/             # データ削除
├── domain-config/         # ドメイン設定生成
└── mail/                  # メール関連
```
