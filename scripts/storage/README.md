# scripts/storage

ファイル保存の新基盤（[src/lib/storage/README.md](../../src/lib/storage/README.md)）が使うバケットを用意するスクリプト。

- `setup.ts`（`pnpm storage:setup`）: 新しい公開バケット（pub）と非公開バケット（priv）を冪等に用意する
- `setup-cors.ts`（`pnpm storage:setup-cors`）: 旧バケット（Firebase の既定バケット）の CORS 設定。新しい 2 バケットには使わない（`storage:setup` が CORS まで設定する）

## pnpm storage:setup

### 前提

- サービスアカウント（`MY_SERVICE_ACCOUNT_KEY`）に「Storage 管理者」（`roles/storage.admin`）。足りないと HTTP 401 / 403 で止まり、その旨を表示する
- バケット名は GCS 全体で一意。プロジェクト ID を含めた名前にすると衝突しにくい（例 `<project-id>-pub` / `<project-id>-priv`）
- 新しい 2 バケットは Firebase に登録しない（クライアント SDK からの経路を作らない）

### 実行

```bash
# 1. 予定だけを表示（読み取りのみ。何も変えない）
pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://app.example.com --dry-run

# 2. 実行
pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://app.example.com [--origin http://localhost:3000] [--location asia-northeast1]

# 3. もう一度実行して、全項目が「変更なし」になることを確かめる
pnpm storage:setup -- --pub <公開バケット> --priv <非公開バケット> --origin https://app.example.com [--origin http://localhost:3000]
```

- `--origin` はアプリの Origin（scheme + host、末尾の `/` なし）。1 つ以上必須で、本番・プレビュー・ローカルなど、ブラウザから直接アップロードする Origin をすべて並べる。`*` は受け付けない
- `--pub` / `--priv` を省略すると env の `STORAGE_PUBLIC_BUCKET` / `STORAGE_PRIVATE_BUCKET` を使う。env ファイルは書き換えない。`APP_ENV` で読む env ファイルを変えられる（既定 `.env.development`）
- 旧バケット（`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`）の名前と、pub / priv に同じ名前は指定できない

### 用意する状態

- 共通: UBLA（均一なバケットレベルのアクセス）有効、CORS（`--origin`、GET / HEAD / PUT、署名 PUT と再開可能アップロードのヘッダー、max-age 3600 秒）
- pub: allUsers に `roles/storage.legacyObjectReader`（オブジェクトの get のみ。一覧は不可）、公開アクセス防止は inherited
- priv: 公開アクセス防止を enforced、allUsers / allAuthenticatedUsers の権限なし

### 冪等性と停止

- バケットが無ければ作る。あれば次の項目を比べ、食い違えば**上書きせずに差分を表示して止まる**
  - location / UBLA / 公開アクセス防止 / CORS
  - priv の公開権限、pub の想定外の公開権限
- 自動で変えるのは pub の公開読み取りの権限を足すことだけ（足すだけなので止まらない）
- 2 回目以降は全項目が「変更なし」になる。止まった場合は表示された差分を手で直す（スクリプトは既存の設定を書き換えない）

### 組織のポリシーで止まる場合

- GCP プロジェクトが組織に属し、組織のポリシーで公開アクセスの防止（`storage.publicAccessPrevention`）やドメイン制限の共有（`iam.allowedPolicyMemberDomains`）が強制されていると、pub に allUsers を付けられずエラーで止まる
- この場合は pub の公開を保留し、組織の管理者にそのバケットだけの例外を相談する。個別の ACL や `makePublic` で回避しない（UBLA では使えず、規則の外の公開になる）
- 組織に属するかは `gcloud projects describe <project-id>` の `parent` で確かめられる

### location（作成場所）

- 既定は `asia-northeast1`。`--location` で変えられる。作成後は変えられない（既存バケットと違えば止まる）
- 旧バケットと location が違うと、旧 URL のファイルを新しいバケットへ copy するとき（import・複製）に地域をまたぐ rewrite になる
  - 大きなファイルは rewrite が複数回の呼び出しに分かれ、時間がかかる。地域間の転送料金もかかる
  - 旧バケットの location は GCP コンソールのバケット詳細、または `gcloud storage buckets describe gs://<旧バケット> --format="value(location)"` で確かめられる
  - 大量の copy が見込まれるなら、旧バケットと同じ location を `--location` で指定することを検討する

### 用意した後

- env を設定する（ローカルの env ファイルと、Vercel などの環境変数）
  - `STORAGE_PUBLIC_BUCKET` / `STORAGE_PRIVATE_BUCKET`（必須）
  - `STORAGE_PUBLIC_PREFIX` / `STORAGE_PRIVATE_PREFIX`（任意。バケット内の置き場所の接頭辞）
  - `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL`（公開ファイルの配信元。例 `https://storage.googleapis.com/<公開バケット>`、`STORAGE_PUBLIC_PREFIX` を使うならそれも含める）
- `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` はビルド時に埋め込まれ、`next.config.ts` の画像の許可リスト（remotePatterns）でも読むので、設定・変更したら再ビルド / 開発サーバーの再起動が必要
- env が未設定のままでも起動と旧経路は壊れない。新しい経路を使った時点で `StorageNotConfiguredError` になる
