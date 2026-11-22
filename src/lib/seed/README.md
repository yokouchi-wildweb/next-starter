# src/lib/seed — ドメインのシードの書き方

## Overview

- 開発・試作のための初期データ(デモの利用者・サンプル)を、持ち主のドメインの `seed.ts` にデータだけで書くための型と関数
- 入れるのはシードのランナー `scripts/runner/seed`(`pnpm ops db seed`。既定は対話でドメインを選び、`--all` で全部)で、各ドメインのサービスを通す
- 依存なし。使う側は各ドメインの `seed.ts` とランナー `scripts/runner/seed/`
- 使う時・直す時の決まりは札 .claude/rules/items/lib/seed.md、seed.ts の層の決まり(データだけ・サービスを通す・lint)は .claude/rules/core/scripts.md にある。この README は使い方と仕組み

## Usage

置き場はドメイン直下 `src/domains/<ドメイン>/seed.ts`(core は `src/domains/core/<ドメイン>/seed.ts`)。一覧ファイルは無く、ランナーが走査する。`pnpm generate domain` が無ければ雛形を書く(write-once、Firestore のドメインは除く)。

```ts
import "server-only";

import { defineSeed, ref } from "@/lib/seed";

export const seed = defineSeed({
  after: ["sampleTag", "sampleCategory"], // 先に入れるドメイン(ref で指すドメインは全部書く)
  tables: {
    samples: [
      {
        $key: "jam", // このドメインの中で一意の名前(ref で指す)
        $unique: ["name"], // 既にあるかを探す列(あれば入れずにその行を使う = 何度打っても同じ)
        name: "季節限定ジャム",
        sample_category_id: ref("sampleCategory", "categoryA"), // 先に入れた行の id に置き換わる
        sample_tag_ids: [ref("sampleTag", "tagA")], // 配列の中も置き換わる
      },
    ],
  },
});
```

- `tables` のキー = DB の表名、行の列 = 表の定義(drizzle)の列のキー(サービスの create が受ける名前)
- 入れるのはその表のドメインのサービス: `seedCreate` があればそれ、無ければ `create`(サービスの無い表は止める)。例: user の `seedCreate` はデモの利用者だけを作る
- `$unique` の行はその列で `search` してから入れる(2 回目は使い回し、行が増えない)。`$unique` の無い行は打つたびに入る
- fork の行から上流の行は `ref("user", "demoUser")` のように指せる

## API

- `defineSeed`・`ref`・`isSeedRef`(値が ref か)・`planSeeds(entries, selected?)`(入れる順と止める理由)・`resolveRow(row, ids)`(ref の置き換え)
- 型 `SeedDefinition` / `SeedRow` / `SeedRef` / `SeedEntry` / `SeedPlan`

## Internals

止める・飛ばす(`planSeeds`):

- 止める(何も入れない): `after` の知らないドメイン・`after` の循環・`after` に無いドメインへの `ref`・無い `$key` への `ref`・閉じたドメインを `after` に持つ開いたシード
- 飛ばす: 閉じた機能のドメイン(そのフォルダを `domains` に持つ規則が閉じている)。名前を出す
- 選んだドメインが `after` で指すドメインは自動で足す
- `defineSeed` が止める: `$key` の形・ドメインの中の `$key` の重複・`$unique` の列が行に無い

## Verification

- `pnpm test src/lib/seed`
