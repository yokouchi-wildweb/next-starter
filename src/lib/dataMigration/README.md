# データマイグレーションライブラリ

管理画面向けに、CSV + ZIP を使ったデータのエクスポート/インポートを提供します。
レコード数が多い場合でもタイムアウトしないよう、チャンク単位の処理が前提です。

## できること
- 単一ドメインのエクスポート/インポート（manifest v1.0）
- リレーションを含む複数ドメインのエクスポート/インポート（manifest v1.1）
- メディア列（画像・動画・ファイル、Multi を含む）の同梱と取り込み（下の「メディア列」）
- チャンク単位の進捗表示と部分成功

## ファイル構成（主要）
- export: `src/lib/dataMigration/export/`
- import: `src/lib/dataMigration/import/`
- UI: `src/lib/dataMigration/components/`
- 設定: `src/lib/dataMigration/config.ts`
- リレーション収集: `src/lib/dataMigration/relations.ts`

## エクスポートの流れ
1. `/api/data-migration/export` にリクエスト
2. サーバーで CSV を生成し ZIP に格納
3. `manifest.json` を同梱して返却

### 出力形式（概要）
- `chunk_XXX/data.csv` をチャンク単位で作成（`CHUNK_SIZE = 100` 固定）
- `assets/{fieldName}/` にメディアを格納（`includeImages = true` の場合）
  - 単一列は `<レコード ID>.<拡張子>`、Multi は `<レコード ID>_<n>.<拡張子>`（n は 1 始まり）

### オプション
- `includeImages`: 画像を含める
  - false の場合も ZIP で出力（CSV のみ）
- `includeRelations`: リレーションを含める
  - hasMany は UI で選択されたもののみ

### 検索条件
- `searchQuery` のみ使用（他のクエリは無視）

## インポートの流れ
1. クライアントで ZIP を展開（JSZip）
2. チャンクの同梱ファイル（`assets/<列>/…`）を `uploadToStorage`（用途 `<camelCase のドメイン>.<列>`、描き直しなし）でアップロードし、CSV の値を ref に置き換える。メイン以外のドメインも同じ
3. チャンクごとに `/api/data-migration/import-chunk` へ送信（今回アップロードした ref を `uploadedRefs` に付ける）
4. チャンク単位で結果を集計。失敗したチャンクで上げたファイルは取り消す（discard）

`POST /api/data-migration/import`（サーバーで ZIP を丸ごと受け取る経路、v1.0 のみ。UI は使っていない）も、チャンクごとに同じ中核（`importChunk`）を使う。同梱ファイルはサーバーから `putFromServer` で書く。

## メディア列（storage オプションの列）
どの列がメディア列か（用途・Multi・scope）は、サービスの `storageFields`（createCrudService の storage オプション、`src/lib/crud/README.md`）が正本。クライアントが送る `imageFields` は使わない。ファイル台帳の操作（putFromServer / copy / 非公開ファイルの読み取り判定）は `DataMigrationMediaResolver`（`media.ts`）として API ルートが注入する（`src/app/api/data-migration/_shared/mediaResolver.ts`。lib は features を import しない）。所有者・判定の主体は実行者（DB と同期した管理者）。

### import
- メディア列は bulkUpsert で書かない（UPDATE SET からも外し、既存の値を保つ）
- 値は TX の外で先に解決し（`import/mediaValues.ts`）、チャンクごとに 1 つの TX で「bulkUpsert（メディア列を外す）→ メディア列のある行ごとの update」を行う。update で storage binding が同じ TX の中で attach / detach する。1 行でも失敗すればチャンク全体を巻き戻す
- 値ごとの扱い:
  - 空 → null（Multi は []）
  - 既存行の今の値と同じ → そのまま（ref・旧 URL・外部 URL のどれでも）
  - `assets/…` → 同梱ファイルから新しい ref（同梱が無ければ失敗）
  - 今回クライアントがアップロードした ref（`uploadedRefs`）→ そのまま（attach が本人・未紐付け・用途一致を検査する）
  - それ以外の ref・自分の旧バケットの旧 URL → copy で新しい ref（元のファイル・元の行の紐付けは変えない）
  - 外部 URL・`/` で始まる値・解釈できない値 → チャンク失敗。エラーに行・列・値を出す
- 1 つでも解決できなければチャンク全体を失敗にする（Multi の一部だけ欠落させて成功にしない。copy に失敗した値の元 ref を複製先に入れない）
- 解決した後に書き込みが失敗した場合、作った ref は未紐付けのまま残り、掃除 cron（storage-sweep）が消す
- CSV にメディア列が無い行・列は触らない。`updateImages = false` はメディア列に触らない（CSV の値は無視）
- Multi の CSV セルはカンマ区切り

### export
- ref の値はサーバーで解決して ZIP に入れる
  - pub → 公開 URL から取得
  - priv → 用途の read を実行者で判定し（`storageObjectService.resolveRead`、admin の暗黙通過なし）、許可されたものだけ短期署名 URL から取得
- http(s) の値は今までどおり取得する
- 取得できなかった値（読み取り権限なし・取得失敗・`/` 始まりなど）は CSV に元の値のまま残し、件数と例を `manifest.json` の `mediaSkipped` とレスポンスヘッダ `X-Media-Skipped`（件数）/ `X-Media-Skipped-Examples`（encodeURIComponent した JSON 配列）に出す。ExportTab は警告のトーストを出す

## manifest について
- v1.0: 単一ドメイン
- v1.1: 複数ドメイン（`related -> main -> hasMany -> junction` の順で import）

## 仕様上の注意点
- `null` と `""` は import 時に区別されず、空文字は `null` 扱い
- 型変換は **メインドメインのみ** `fieldType` を参考に実施
  - 関連ドメイン/中間テーブルは文字列のまま
- `maxRecordLimit` は export のみで制限
  - チャンク import では総件数の制限を行わない
- システムフィールド（`createdAt` など）はそのまま渡すだけで、永続化はスキーマ次第

## 主要エンドポイント
- `POST /api/data-migration/export`
- `POST /api/data-migration/import-chunk`
- `POST /api/data-migration/import`（サーバー ZIP 経路、UI 未使用）

## テスト
- `pnpm test:data-migration`: 値の分類・解決、export のメディア取得、注入する resolver（DB なし）
- `pnpm test:data-migration-db`: 実 DB の import（旧 URL の copy・同梱・外部 URL の失敗と巻き戻し・copy 失敗・同じ値の保持・bulkUpsert にメディア列が渡らない）
