# Scripts

開発・運用で使用するスクリプト群です。

## コマンド一覧

### 環境変数 (env)

```bash
# .env.example → .env.development を生成し、最小起動に必要な値を自動設定
# (APP_BASE_URL=localhost / AUTH_JWT_SECRET / ENCRYPTION_KEY をランダム生成。既存なら何もしない)
pnpm env:init

# 別名のファイルを作る場合
pnpm env:init .env.local
```

用途: フォーク直後やクローン直後の最初の一歩。Firebase / DB 未設定でも dev サーバーが起動する状態を作る。一次情報:

➡ [新規プロジェクトの立ち上げ: フォークからデプロイまで](../docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md)

### ワークツリー (worktree)

```bash
# 本体の隣 (../<repo名>.wt-<branch>) にワークツリーを作り、env 等を複製して pnpm install
pnpm worktree:new <branch> [--from <base>] [--path <dir>]

# 既存ワークツリーへ env 等を入れ直す (既定は上書きしない。--force で上書き)
pnpm worktree:sync [path] [--force]

# 未コミットの変更が無いことを確かめて外す (ブランチは残す)
pnpm worktree:remove <path>
```

複製するファイルの一覧は `scripts/worktree/include`。DB は本体と共有になる点に注意。詳細: [worktree/README.md](./worktree/README.md)

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

# core ドメインの drizzle.ts が全て schemaRegistry に登録されているか検証
# (登録漏れ = db:push でテーブルが作られない。core ドメイン追加時に実行)
pnpm test:schema-registry

# push の読み取り専用ドライラン: スキーマと DB を比較し、実行される SQL を表示 (1 文でもあれば exit 1)
# (index を追加・変更したら db:push 後に差分ゼロを確認。APP_ENV=.env.production で本番の事前確認にも)
pnpm db:push:check
```

詳細: [registry/README.md](./registry/README.md)

詳細: [db/seed/README.md](./db/seed/README.md)

### ドメイン設定 (dc)

```bash
pnpm dc:init                # domain.json を対話で作成
pnpm dc:generate <Domain>   # ファイル生成（`--` は付けない）
pnpm dc:generate:all        # 複数ドメイン一括生成
pnpm dc:add <Domain>        # フィールド追加
pnpm dc:delete <Domain>     # ドメイン削除
```

詳細: [domain-config/README.md](./domain-config/README.md)

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

### Storage (バケット)

```bash
# ファイル保存の新しい公開バケット(pub)と非公開バケット(priv)を冪等に用意(UBLA・公開設定・CORS まで)
pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://your-app.com --dry-run

# 旧バケット(Firebase の既定バケット)の CORS。旧 URL のバイトをブラウザで読む機能を使う場合だけ
pnpm storage:setup-cors https://your-app.com
```

手順・前提(サービスアカウントに Storage 管理者)・冪等性・組織のポリシーで止まる場合・location は [scripts/storage/README.md](storage/README.md)、CORS の判定ルールは [Storage の CORS 設定（リモートメディア読み取りの基盤前提）](../docs/setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md)。

### 定期タスク (task / cron)

```bash
# 運用タスクを CLI から実行(定期タスク + ワンショット)
pnpm task <task-name>
pnpm task --list               # 一覧(頻度・有効/無効・説明)
pnpm task --due                # 今の分(UTC)に schedule が一致する定期タスクを実行(Vercel 以外のスケジューラから毎分呼ぶ)

# vercel.json の crons を src/app/api/cron/*/task.ts から生成(crons 以外のキーは保持。タスク増減・プラン変更のたびに実行)
pnpm cron:generate --plan hobby   # Vercel Hobby: 全タスク 1 日 1 回
pnpm cron:generate --plan pro     # Vercel Pro: task.ts の schedule どおり

# vercel.json の crons が task.ts と一致するか検査(deploy:all と Vercel 上の pnpm build が先に実行)
pnpm cron:check
```

- `pnpm task` は env ファイルを読む（`APP_ENV`、既定 `.env.development`。設定済みの環境変数は上書きしない、ファイルが無ければそのまま進む）。
- タスクは `import "server-only"` を持つ server コードに届くため、`task` スクリプトもテストと同じ preload（`scripts/test/serverOnlyStub.mjs`、下記「テスト」）を付けている。

定期タスクは 1 タスク 1 フォルダ `src/app/api/cron/<name>/`(task.ts + route.ts)。一次情報:

➡ [src/lib/cron/README.md](../src/lib/cron/README.md)

### デプロイ (統合)

```bash
# アプリ(Vercel) + ルームサーバー(Cloudflare) を1コマンドで揃えてデプロイ(手動運用の標準)
# room 無効フォークでは Worker を skip しアプリのみ。引数は vercel CLI へ透過(無指定なら --prod)
pnpm deploy:all
pnpm deploy:all -- --target=preview
```

事前に `pnpm cron:check` を実行し、`vercel.json` の crons が `task.ts` と食い違えば何もデプロイせず止まる。

※ vercel CLI に `--preview` フラグは無い(`--prod` は `--target=production` の短縮形)。プレビューは `--target=preview` を明示する

### リアルタイムルーム (room)

```bash
# 有効化セットアップ(wrangler.toml 生成 + 依存インストール + チェックリスト表示。冪等)
pnpm room:init

# Worker 単体デプロイ(config enabled=false なら skip。既定Worker名 "room-server" は拒否。冪等)
pnpm room:deploy

# 共有鍵の生成 + Worker への非対話登録 + Next側env行の表示(未デプロイWorkerと登録済み鍵の上書きは拒否)
pnpm room:secret
pnpm room:secret --rotate   # 鍵ローテーション(Next側envの差し替えとセットで)

# デプロイ済み Worker の動作確認(疎通・認可・WS配信・永続化の11項目。env から接続先を読む)
pnpm room:check

# ローカル実行(Cloudflare アカウント不要。wrangler dev)
pnpm room:dev
```

用途: ホットパス・リアルタイム基盤 `servers/room` (Cloudflare Durable Objects) の運用コマンド。オプトイン既定無効。手順・env・CI 連携の一次情報:

➡ [servers/room/README.md](../servers/room/README.md)

### テスト (tsx で動かすもの)

tsx で動かすテスト（`*.test.ts` / `*.test.mts`、TypeScript を import する `*.test.mjs`）の package.json スクリプトは、必ず `--import ./scripts/test/serverOnlyStub.mjs` を付ける。

```bash
npx tsx --import ./scripts/test/serverOnlyStub.mjs --test <テストファイル>
```

- 理由: `import "server-only"` は Next のバンドラーだけが解決する。テストが serviceRegistry などから server コードへ import をたどると、素の tsx では `Cannot find module 'server-only'` で全件落ちる（依存の import 連鎖次第なので、今通っているテストもドメイン追加で落ち始める）。
- preload はテスト実行時だけ `server-only` を空モジュールに差し替える。ソース側の `import "server-only"` は消さない。
- `server-only` を devDependencies に入れても解決しない（本物は react-server 条件以外では import 時に throw する）。
- `--experimental-test-module-mocks`（`mock.module`）を使うテストでも同じ preload で足りる。module mocks を有効にすると CJS の require が import のフックを通らないため、preload は `Module._resolveFilename` も包んでいる。回帰テスト: `pnpm test:server-only-stub`。
- `mock.module` は後から読み込むモジュールにしか効かない。モックの影響を受けるモジュールは `mock.module` の後に動的 import する（例: `src/features/core/storageObject/callsites.test.mts`）。

## ディレクトリ構成

```
scripts/
├── README.md              # このファイル
├── test-claude-api.ts     # Claude API 接続確認
├── db/                    # データベース関連
│   ├── seed/              # シーダー
│   └── clear/             # データ削除
├── cron/                  # vercel.json の cron 生成・検査
├── domain-config/         # ドメイン設定生成
├── env/                   # .env 初期生成
├── mail/                  # メール関連
├── room/                  # リアルタイムルーム基盤の init / deploy
├── test/                  # テスト実行用の preload (server-only の差し替え)
├── worktree/              # ワークツリーの作成・env 複製・片付け
└── tasks/                 # 運用タスクの CLI ランナー (pnpm task)
```
