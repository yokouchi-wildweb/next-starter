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

### Storage (CORS)

```bash
# Firebase Storage バケットに CORS を設定(origin は "*")
pnpm storage:setup-cors

# origin を実ドメインに限定(本番推奨)
pnpm storage:setup-cors https://your-app.com https://www.your-app.com
```

用途: 別ドメインの Storage バイトをブラウザで読む全機能(MSE / `fetch()` / `<video crossOrigin>`→canvas / Web Audio)の共通基盤前提。バケット単位・一度きりの設定。判定ルール・トラブルシュート・前提(権限/env)は一次情報に集約:

➡ [Storage の CORS 設定（リモートメディア読み取りの基盤前提）](../docs/setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md)

事前設定: `MY_SERVICE_ACCOUNT_KEY`(storage.buckets.update 権限) と `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

### Storage (新しい 2 バケットの用意)

```bash
# 予定だけを表示(読み取りのみ。何も変えない)
pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://your-app.com --dry-run

# 実行(冪等。2 回目以降は「変更なし」)
pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://your-app.com [--origin ...] [--location asia-northeast1]
```

ファイル保存の新基盤([src/lib/storage/README.md](../src/lib/storage/README.md))が使う、新しい公開バケット(pub)と非公開バケット(priv)を用意する。旧バケット(Firebase の既定バケット)には触れず、新しい 2 バケットは Firebase に登録しない。

- 用意する状態
  - 共通: UBLA 有効、CORS(`--origin`、GET / HEAD / PUT、署名 PUT と再開可能アップロードのヘッダー)
  - pub: allUsers に `roles/storage.legacyObjectReader`(オブジェクトの get のみ。一覧は不可)
  - priv: 公開アクセス防止を enforced。公開の権限なし
- バケットが無ければ作る(location の既定は `asia-northeast1`)
- 既にあれば次の項目を比べ、食い違えば**上書きせずに差分を表示して止まる**
  - location / UBLA / 公開アクセス防止 / CORS
  - priv の公開権限、pub の想定外の公開権限
  - pub の公開読み取りの権限は、無ければ足す(足すだけなので止まらない)
- `--pub` / `--priv` を省略すると env の `STORAGE_PUBLIC_BUCKET` / `STORAGE_PRIVATE_BUCKET` を使う。env ファイルは書き換えない。`APP_ENV` で読む env ファイルを変えられる(既定 `.env.development`)
- 旧バケット(`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`)の名前は指定できない。`--origin "*"` も受け付けない
- 権限が足りないと止まる。サービスアカウント(`MY_SERVICE_ACCOUNT_KEY`)に「Storage 管理者」を付ける
- 組織のポリシー(公開アクセスの禁止など)で pub を公開できない場合も、エラーで止まる。その場合は public の切替を保留する(既存の ACL を変えて回避しない)

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
└── tasks/                 # 運用タスクの CLI ランナー (pnpm task)
```
