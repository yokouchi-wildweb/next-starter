# legal — 法務の文書(利用規約・プライバシーポリシー・特定商取引法に基づく表示)

## Overview

- 表を持たない core ドメイン。文書の例文・文書ごとの印(sample / own)・差し込み済みの文書を返す公開の入口(`documents.ts`)・本番の検査を持つ。作りは事業の素性 `src/lib/business` の結び(`@/business`)と同じ
- 使う時・直す時の決まりは札 .claude/rules/items/features/legal.md にある。この README は使い方と仕組み

## Usage

初期化: `pnpm ops legal from-example [terms|privacy|tradelaw …] [--force]` = 例文を上書きへリテラルで写して own にする(種類を省くと 3 文書とも)。

- 既に own の文書は `--force` が無い限り変えない
- 上書きのファイルは今の値から書き直す(他のキーは残る、ファイル冒頭のコメントは道具が決めた文に戻る)

## API

- `getLegalDocument(kind)`: 差し込み済みの文書を返す。文面(sample = 例文、own = 上書き)の題名・本文・子の節の `{{NAME}}` を埋める: `SERVICE_NAME`・`DOMAIN`・`COMPANY_NAME`・`REPRESENTATIVE`・`POSTAL_CODE`・`ADDRESS`・`PHONE`・`EMAIL`(`@/business`)、`PAYMENT_METHODS`(legal)。利用規約・プライバシーポリシーは文面に `enactedAt` が無ければ `business.launchedAt`
- `getLegalEnactedAtFormat()`: 日付の行の文言(`LegalDocumentRenderer` の `enactedAtFormat` に渡す)
- `buildLegalDocument(kind, config, business, examples?)`: 上の純関数版(テスト・他の値で組むとき)
- 入口は `@/domains/legal/documents`(別名は tsconfig の `@/domains/legal/*`)

## Extension

上書き `src/config/domains/legal.config.ts`。

文書の選び方 `documents.<kind>`(kind = `terms` / `privacy` / `tradelaw`):

- `{ source: "sample" }`(既定。上流はこれで出荷する)= 上流の例文 `examples/<kind>.ts` を表示する。開発と Tier1 のデモ用
- `{ source: "own", document: { title, sections, … } }` = このプロジェクトの文面(型 `LegalOverride`)。制定日・最終改定日は文面の `enactedAt` / `lastUpdatedAt` に書く
- 例文の変更履歴は `examples/CHANGELOG.md`

ほかのキー:

- `paymentMethods`: 支払方法の表示(文面の `{{PAYMENT_METHODS}}`)
- `licenses`: 許認可の一覧(`{ type, label, details: [{ key?, value }] }`)。文面の id `"licenses"` の節の中身をこれで埋め、空なら節ごと外す
- `enactedAtFormat`: 制定日・最終改定日の行の文言(`LegalEnactedAtFormat`、空 = `lib/structuredDocument` の Renderer の既定)

## Internals

- 本番の検査 `pnpm check legal`(`pnpm build` の最初に回る `pnpm check --phase=build` に入る): sample の文書が 1 つでもあるまま本番でビルドすると失敗する。Tier1 は警告だけ。判定は事業の素性と同じ部品(`@/lib/business` の `sampleReleaseLevel`)

## Verification

- `pnpm test src/domains/core/legal`(例文・印・差し込み・合成の検査・本番の検査)
- `pnpm test scripts/operations/legal`(初期化の道具)
- `pnpm check legal`
