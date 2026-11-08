# legal — 法務の文書(利用規約・プライバシーポリシー・特定商取引法に基づく表示)

表を持たない core ドメイン。文書の例文・文書ごとの印(sample / own)・差し込み済みの文書を返す口・本番の検査を持つ(設定の議会 D21・D23・L1.24。形は事業の素性 `src/lib/business` の受付係と同じ)。

## 文書の選び方(印)

上書き `src/config/features/legal.config.ts` の `documents.<kind>`(kind = `terms` / `privacy` / `tradelaw`):

- `{ source: "sample" }`(既定。上流はこれで出荷する)= 上流の例文 `examples/<kind>.ts` を表示する。開発と Tier1 のデモ用
- `{ source: "own", document: { title, sections, … } }` = このプロジェクトの文面。`document` は型で必須(`LegalOverride` は文書ごとに丸ごと書く)。制定日・最終改定日は文面の `enactedAt` / `lastUpdatedAt` に書く
- sample の文書が 1 つでもあるまま本番でビルドすると `pnpm check legal`(門 build)が失敗する。Tier1 は警告だけ。判定は事業の素性と同じ部品(`@/lib/business` の `sampleReleaseLevel`)
- 例文は fork が編集しない。変更は `examples/CHANGELOG.md` と notice で知らせ、取り入れるかは fork が own の文面を直して決める

初期化: `pnpm ops legal from-example [terms|privacy|tradelaw …] [--force]` = 例文を上書きへリテラルで写して own にする(種類を省くと 3 文書とも)。既に own の文書は `--force` が無い限り変えない。上書きのファイルは今の値から書き直す(他のキーは残る、手で書いた注記は決まった頭に戻る)。

## 上書きのほかのキー

- `paymentMethods`: 支払方法の表示(文面の `{{PAYMENT_METHODS}}`)。既定は今までの値
- `licenses`: 許認可の一覧(`{ type, label, details: [{ key?, value }] }`)。文面の id `"licenses"` の節の中身をこれで埋め、空なら節ごと外す
- `enactedAtFormat`: 制定日・最終改定日の行の文言(`LegalEnactedAtFormat`、空 = `lib/structuredDocument` の Renderer の既定)

## 差し込みと公開の口

- `getLegalDocument(kind)`: 差し込み済みの文書を返す。文面(sample = 例文、own = 上書き)の題名・本文・子の節の `{{NAME}}` を埋める: `SERVICE_NAME`・`DOMAIN`・`COMPANY_NAME`・`REPRESENTATIVE`・`POSTAL_CODE`・`ADDRESS`・`PHONE`・`EMAIL`(`@/business`)、`PAYMENT_METHODS`(legal)。利用規約・プライバシーポリシーは文面に `enactedAt` が無ければ `business.launchedAt`
- `getLegalEnactedAtFormat()`: 日付の行の文言(`LegalDocumentRenderer` の `enactedAtFormat` に渡す)
- `buildLegalDocument(kind, config, business, examples?)`: 上の純関数版(テスト・他の値で組むとき)
- 読み手は `@/features/core/legal` の口を使い、`LEGAL_CONFIG` を直に読まない

## テスト

`pnpm test src/features/core/legal`(例文・印・差し込み・合成の検査・本番の検査)| `pnpm test scripts/operations/legal`(初期化の道具)| `pnpm check legal`
