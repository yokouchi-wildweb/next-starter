# データマイグレーションライブラリ

## Overview

- 管理画面向けに、CSV + ZIP を使ったデータのエクスポート/インポートを提供する
- レコード数が多くてもタイムアウトしないよう、チャンク単位の処理が前提
- 単一ドメインのエクスポート/インポート（manifest v1.0）
- リレーションを含む複数ドメインのエクスポート/インポート（manifest v1.1）
- メディア列（画像・動画・ファイル、Multi を含む）の同梱と取り込み（下の「メディア列」）
- チャンク単位の進捗表示。失敗したチャンクで全体を止め、入ったもの・入っていないものを分けて出す（下の「失敗したとき」）
- 閉じた lib。入口は 2 つ(package.json の exports)で、中のファイルは外から読まない:
  - `@/lib/dataMigration`: 管理画面の部品(`DataMigrationButton` / `DataMigrationModal` / `ExportSettingsModal`)・フック・`buildExportFields`・設定の上書きの型 `DataMigrationOverride`
  - `@/lib/dataMigration/server`(server-only): API ルートが使う `exportData` / `exportDataWithRelations` / `importData` / `importChunk` / `importServiceChunk` と型、メディアのヘッダー名 `MEDIA_SKIPPED_HEADER` / `MEDIA_SKIPPED_EXAMPLES_HEADER`、注入の型 `DataMigrationMediaResolver` など、`collectionFieldsOf`
  - client の部品をルートの読み込みに入れないため 2 つに分ける。どちらの入口も "use client" を付けない

## Usage

### エクスポート

1. `/api/data-migration/export` にリクエスト
2. サーバーで CSV を生成し ZIP に格納
3. `manifest.json` を同梱して返却

- オプション `includeImages`: 画像を含める(false でも ZIP で出す。CSV のみ)
- オプション `includeRelations`: リレーションを含める(hasMany は UI で選んだものだけ)
- 検索条件は `searchQuery` だけを使う(他のクエリは無視)
- `maxRecordLimit` は export だけを制限する(チャンク import では総件数を制限しない)

### インポート

1. クライアントで ZIP を展開（JSZip）
2. チャンクの同梱ファイル（`assets/<列>/…`）を `uploadToStorage`（用途 `<camelCase のドメイン>.<列>`、描き直しなし）でアップロードし、CSV の値を ref に置き換える。メイン以外のドメインも同じ
3. チャンクごとに `/api/data-migration/import-chunk` へ送信（今回アップロードした ref を `uploadedRefs` に付ける）
4. チャンク単位で結果を集計。失敗したチャンクで上げたファイルは取り消す（discard）。最初に失敗したチャンクで全体を止める（下の「失敗したとき」）

- 失敗して途中で止まったら、原因を直して同じファイルを取り込み直す(チャンクは upsert なので、入ったチャンクは上書きされ残りが続けて入る)
- 関連ドメインの行は既にある行に反映されないので、関連のドメインを直すならそのドメインの画面で書き出し・取り込みする

### 取り込み中の未保存の守り

取り込み中は、ページの移動・戻る / 進む・再読み込みに確認を出す(`src/lib/unsavedGuard`、理由 = 処理の途中 `inProgress`。確認の文は上書き `src/config/lib/unsavedGuard.config.ts`)。自前の `beforeunload` は持たない。

- 外す: `guardUnsaved={false}`(`DataMigrationButton` / `DataMigrationModal` / `useImportHandler`、既定 true)
- 何を守るかの判定: `ImportTab/hooks/importGuard.ts`(テスト `pnpm test src/lib/`)
- モーダルを閉じる操作は移動ではないので聞かない(閉じても取り込みは続く)

## API

### エンドポイント

- `POST /api/data-migration/export`
- `POST /api/data-migration/import-chunk`
- `POST /api/data-migration/import`(サーバーで ZIP を丸ごと受け取る経路、v1.0 のみ)もチャンクごとに同じ中核(`importChunk`)を使う。同梱ファイルはサーバーから `putFromServer` で書く

### manifest

- v1.0: 単一ドメイン
- v1.1: 複数ドメイン（`related -> main -> hasMany -> junction` の順で import）

### 出力形式

- `chunk_XXX/data.csv` をチャンク単位で作成（`CHUNK_SIZE = 100` 固定）
- `assets/{fieldName}/` にメディアを格納（`includeImages = true` の場合）
  - 単一列は `<レコード ID>.<拡張子>`、Multi は `<レコード ID>_<n>.<拡張子>`（n は 1 始まり）

### 値の扱い

- `null` と `""` は import 時に区別されず、空文字は `null` 扱い
- 型変換は **メインドメインのみ** `fieldType` を参考に実施
  - 関連ドメイン/中間テーブルは文字列のまま
  - 配列（型の表の array 属性 = `array`・`stringArray`）はカンマ区切りのセルを配列にする。主の集まり（`mediaCollection`）は取り込まない
    - インポート画面は集まりの項目を `fields` に入れない（`buildImportFieldTypeInfo`）。サーバーは申告された集まりの項目を 400 で拒否する
  - 日付・時刻・数値は型の表（`src/lib/domain/fields/fieldTypes.mjs`）の `importValue` 属性で読む（型名を小文字にして比べない。表に無い型名は文字のまま）
    - `date`（date・timestamp・timestamp With Time Zone）: 値はそのまま、日付として読めない値は `null`
    - `time`（time）: 空欄だけ `null`、値はそのまま（不正な値は DB への書き込みで行のエラー）
    - `number`（integer・number・float・bigint・numeric(10,2)）: 数値に、読めない値は `null`
- システムフィールド（`createdAt` など）はそのまま渡すだけで、永続化はスキーマ次第

### 注入するもの

lib は登録表を import しない。API ルートが `src/wiring/domainRegistry.ts`・`src/wiring/domainConfig.ts` の登録表を引く関数を渡す。DataMigrationButton は表示用の写し（`entities/display.ts` の `domainDisplay`）を受ける。

- `services`: ドメイン名からサービスを引く(`getService`)
- `junctionTables`: 多対多の結びの表を物理の表の名前から引く(`getJunctionTable`)。書き出す結びは `through` を書いた持つ側の関係だけで、表・列は結びの登録の宣言から読む(`junctionColumnsOf`、D354。反対側は結びを出さない)
- `domainConfigs`: export で関連を含めるときにドメイン名から設定を引く(`getDomainConfig`)
- `media`: ファイル台帳の操作

## Internals

### 失敗したとき

- 進め方は `components/DataMigrationModal/ImportTab/hooks/importRun.ts`（純関数 `runImportSteps`、テスト `importRun.test.ts`）
- チャンクは 1 つずつ別の TX で書く。失敗したチャンクは丸ごと巻き戻るが、それより前のチャンクは DB に入ったまま（取り消さない）
- 最初に失敗したチャンクで全体を止め、後のチャンク（同じドメインの残りと、後に続くドメイン）は流さない。後のドメイン（main・hasMany・中間テーブル）は前のドメインの行を前提にするため、親のチャンクが欠けたまま進めない
- 結果画面は「インポート失敗（途中で停止）」として、DB に入ったもの（チャンク数・件数）と入っていないもの（失敗したチャンク + 流さなかったチャンク）を分けて出す（`ImportResultData` の `stoppedAt` / `notRunChunks`）
- `onImportSuccess`（一覧の再取得）は DB が変わったとき（途中で止まった場合も、入ったチャンクがあれば）に呼ぶ。成否の表示は結果画面が持つ

### 関連ドメイン（related）は無い行だけ足す

- v1.1 の関連ドメイン（belongsTo の相手を一緒に書き出したもの）は、既にある行（同じ id）に触らず、無い行だけ足す（`importChunk` の `existingRowsFor` → `bulkUpsert` の `skipDuplicates`）
- 取り込みの目的はメインのドメインで、関連は参照先を揃えるため。全行を upsert すると、変わっていない関連の行の `updatedAt` まで毎回書き換わる
- そのため ZIP の中で関連の行を書き換えても、既にある行には反映されない。既にある行のメディア列も解決しない
- 件数（`recordCount`）は CSV の行数（スキップした行も数える）

### メディア列(storage オプションの列)

どの列がメディア列か（用途・Multi・scope）は、サービスの `storageFields`（createCrudService の storage オプション、`src/lib/crud/README.md`）が正本。クライアントが送る `imageFields` は使わない。ファイル台帳 storageObject の操作（putFromServer / copy / 非公開ファイルの読み取り判定）は `DataMigrationMediaResolver`（`media.ts`）として API ルートが注入する（`src/app/api/data-migration/_shared/mediaResolver.ts`。lib は features を import しない）。所有者・判定の主体は実行者（DB と同期した管理者）。

#### import

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

#### export

- ref の値はサーバーで解決して ZIP に入れる
  - pub → 公開 URL から取得
  - priv → 用途の read を実行者で判定し（`storageObjectService.resolveRead`、admin の暗黙通過なし）、許可されたものだけ短期署名 URL から取得
- http(s) の値は今までどおり取得する
- 取得できなかった値（読み取り権限なし・取得失敗・`/` 始まりなど）は CSV に元の値のまま残し、件数と例を `manifest.json` の `mediaSkipped` とレスポンスヘッダ `X-Media-Skipped`（件数）/ `X-Media-Skipped-Examples`（encodeURIComponent した JSON 配列）に出す。ExportTab は警告のトーストを出す

### 依存(読む lib)

- 読む lib は package.json の `libs`(crud・defineConfig・domain・drizzle・errors・storage・stringCase・toast・unsavedGuard)、棚は `peers` の components。設定の上書きは `@lib-config/dataMigration` だけ
- 閉じた lib(drizzle・errors・toast・unsavedGuard など)は入口だけを読む(守りの lib は `@/lib/unsavedGuard`)

## Verification

- `pnpm test src/lib/dataMigration src/domains/core/storageObject/dataMigrationResolver.test.ts`: 値の分類・解決、export のメディア取得、注入する resolver（DB なし）
- `pnpm test --db src/domains/core/storageObject/dataMigrationImport.db.test.ts`: 実 DB の import（旧 URL の copy・同梱・外部 URL の失敗と巻き戻し・copy 失敗・同じ値の保持・bulkUpsert にメディア列が渡らない）
- 取り込み中の守りの判定: `pnpm test src/lib/`(`ImportTab/hooks/importGuard.ts`)

## Related

- メディア列の正本 `storageFields`(createCrudService の storage オプション): `src/lib/crud/README.md`
- 型の表: `src/lib/domain/fields/fieldTypes.mjs`
- 未保存の守り: `src/lib/unsavedGuard`
