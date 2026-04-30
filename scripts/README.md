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

### 監査ログ移行 (audit)

旧 `user_action_logs` から新 `audit_logs` へ過去ログを移行する。

```bash
# 移行内容を DB に書き込まず確認
pnpm audit:migrate -- --dry-run

# 移行を実行 (バッチサイズ既定 1000、再実行で冪等)
pnpm audit:migrate

# 旧テーブルの削除前確認
pnpm audit:drop-legacy -- --dry-run

# 旧テーブルを削除
pnpm audit:drop-legacy -- --confirm
```

詳細: [`docs/how-to/監査ログ基盤への移行.md`](../docs/how-to/監査ログ基盤への移行.md)

### Claude API

```bash
# API接続確認
pnpm claude:test
```

事前設定: `.env.development` に `ANTHROPIC_API_KEY` を設定

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
