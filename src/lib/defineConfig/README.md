# defineConfig

## Overview

- lib の設定の共通の合成器。既定 + 規則 → 上書きを受けて合成し、検査して返す。依存なし(宣言済みの lib: `package.json` の `libs` は空)
- 届け方の全体は [../README.md](../README.md)「設定の届け方」
- 使う時・直す時の決まりは札 .claude/rules/items/lib/defineConfig.md にある。この README は使い方と仕組み

## Usage

lib の側の `config.ts`:

```ts
// src/lib/toast/config.ts
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/toast";
import type { ToastConfig } from "./types";

const defaults: ToastConfig = { duration: 3000, positions: [{ key: "top", offset: 16 }] }; // 型で注釈する
const toastConfigDef = defineConfig(defaults, { label: "toast", arrays: { positions: { by: "key" } }, schema });

export type ToastOverride<E extends object = {}> = OverrideOf<typeof toastConfigDef, E>; // 入口から型だけ出す
export const toastConfig = toastConfigDef.compose(override);
```

## API

- `defineConfig(defaults, rules?)` → `{ defaults, rules, compose }`
- `rules.label` = 誤りの文の頭(`[toast] …`)
- `rules.arrays` = 既定の形をなぞる配列の規則。配列のキーに `"replace"`(既定。書かない配列もこれ)・`"append"`(既定の後ろに足す)・`{ by: "<id のキー>" }`(id で合わせる)。入れ子のオブジェクトはその中の規則を書く
- `rules.schema` = Standard Schema(`~standard.validate`。zod 3.25 の schema はそのまま渡せる)
- `compose<Extra>(override)` → `WithExtra<D, Extra>`(既定と Extra を深く合成した型。Extension)。既定は変えない(写しを返す)

合成の決まり:

- オブジェクト(プレーンなもの)は深く合成する。関数・Date・クラスの値などは丸ごと置き換える
- `undefined` = 変えない | `null` = そのキーを消す
- `{ by }` の配列: 同じ id の項目は深く合成(位置は既定のまま)、知らない id は末尾に足す、`{ <id>: x, $delete: true }` で消す(無い id を消そうとすると誤り)。項目に id が無いと誤り
- 既定に無いキー(fork 独自のキー)はそのまま写す。型は `XxxOverride<{ myKey: … }>` の型引数で足す(Extension)
- 規則の形が既定に合わない(配列でないキーに配列の規則など)と `defineConfig` の時点で `ConfigError`、検査に通らないと `ConfigValidationError`(`issues: { message, path }[]`)

型:

- `Override<D, A, Extra>`(深い部分・省略できるキーの null・`{ by }` の配列は id 必須の部分の項目・Extra は深く合成)
- `WithExtra<D, Extra>`(compose の結果の型)
- `OverrideOf<typeof def, Extra>`
- `StandardSchemaV1`(仕様の型の写し。zod を読まない)

## Extension

### Extra

Extra(fork が足す型): 上書きの型 `XxxOverride<Extra>` と `compose<Extra>` は、Extra を既定の型と深く合成する(交差型 `D & Extra` にはしない)。

- 既定に無いキー = Extra の型のまま足す(`{ myKey: number }`)
- 既定と重なるキーで、両方がオブジェクト = 中へ入って合成する(`{ type: { direct_sale: PurchaseTypeConfig } }` は既定の購入タイプに足す)
- 既定と重なるキーで、配列などそれ以外 = Extra の型で置き換える。既定の型に代入できる型だけを受け、型を変えるもの(`string` を `number` に、など)は never になって落ちる。上流のコードが読む形は変わらない
  - 配列の項目に fork の欄を足す: `export type Extra = { payment: { paymentMethods: (PaymentMethodConfig & { bonus?: { rate: number } })[] } };`。上書きには項目ごとに `bonus` を書け、`purchaseRequestConfig.payment.paymentMethods.find(…)?.bonus` が型で読める
  - 配列の規則(`replace` / `append` / `{ by }`)は広げた項目の型でそのまま効く
- Extra を書かない上書きは今までと同じ型

## Verification

- `pnpm test src/lib/defineConfig`(合成と検査。zod の schema と手書きの Standard Schema)
- 型は `defineConfig.types.test.ts` を `pnpm typecheck` が確かめる
