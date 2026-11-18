# scripts/structure/message — 新しい連絡の書き出し

## Overview

- fork(と上流)が新しい連絡を足す時の定義 1 本を、上流の連絡と同じ形(ひな形 + 欄の中身)で書き出す。書いた後は手で直すファイル(write-once)
- 連絡そのものの決まり: `src/features/core/messaging/README.md`

## Usage

```
pnpm generate message -- <domain> <name> --category <key> --label <名前> [--var <鍵>:<別名>:<説明> ...] [--core]
```

- 書いた時は `pnpm generate registry`(`src/registry/messageRegistry.ts`)を回す
- 引数なし(`pnpm generate` の一括)= 何もしない(exit 0)。質問はしない(-i は無い)

### 引数

- `--label`(必須): 管理画面に出す連絡の名前(例 `--label 注文の発送`)。定義の `label` に書く。運営する人は鍵を読まない。表示だけなので fork は上書き(`label`)で変えられる
- `--var`(任意・繰り返せる): vars の値 1 つ = `<鍵>:<別名>:<説明>`(例 `--var orderId:注文番号:受け付けた注文の番号`。説明は `:` を含んでよい)。定義の `vars` と `varNames`(全部の鍵に必須の日本語の別名と説明)に書き、最初の値を件名と本文に `{{別名}}` で置く。鍵は英小文字始まりの camelCase、別名は空白・記号なしで英数字以外の字を含む(埋め込み情報の別名と同じ形)。共通・enrichers と同じ鍵ならその別名を書く(重なりは送る時の `validateMessageDefinition` が止める)
- `--category`(必須): categories の受け口の鍵。種類 = 利用者から見て 1 つの出来事(「〜した時」と言える単位。例 likeReceived・itemSold・passwordReset・pointExpiring)で、ドメイン・機能の単位(shop・account・wallet)にはしない。無ければ先に `src/features/core/messaging/categories/<名前>.ts`(種別・経路を持つ)を足す。無い・知らない時は名前の付け方を案内して止まる
- 経路ごとの欄は書かない(どの種類でも同じ定義)。fork の経路は経路の項目が汎用の描き方か要約からの描き方を宣言していれば描ける。`--kind`・`--channels` は無くなった(渡すと止まる)

## API

### 書く物

- 書く物(無い時だけ。あれば触らず「残しました」と出して exit 0):
  - `src/features/<domain>/messages/<name>.ts` — 定義(`defineMessage`。鍵 `<domain>.<name>`・category・`--var` の vars(各 `z.string()`)と `varNames`(無ければ空の vars と `varNames: {}`)・ひな形 `layout: "notice"`(汎用のお知らせ)と欄の中身 `values`(件名 + 段落のブロック)。種別と経路は書かない = 種類から引く)。秘密の値(`secretVar`)・管理画面で直せる欄の絞り(`adminEditableOnly`、無ければ全部の欄を直せる)・会話の間引き(`throttle`)・本文の残し方(`record`)は注記の行で案内するだけで付けない
  - 描き方は書かない: 見た目はひな形が持つ(どの経路もひな形の描き方・経路の汎用・要約のどれかで描く)。別の見た目は `src/features/core/messaging/layouts/<名前>/` のひな形を選ぶか足し、`layout` と `values` の欄の鍵を合わせる

### exit

- exit 2(書かない、理由を出す): 知らない引数・`<domain>` が features の地区に無い・`<name>` が英小文字始まりの camelCase でない・core のドメインに `--core` が無い(fork の持ち場の外 = `pnpm workflow ownership check` が落ちる)・`--category` が無い・`--label` が無い・受け口に無い category・種類の経路が経路の受け口に無い・`--var` の形が違う(3 つに分けられない・鍵の形・別名の形・鍵か別名の重なり)

## Internals

- 役目: `scaffold.mjs`(引数・検査・書き出し)、`templates.mjs`(雛形)、`generate.mjs`(門の入口)

## Verification

- `pnpm test scripts/structure/message/scaffold.test.ts`(一時の木で書き、validateMessageDefinition と messageGuards を通す)

## Related

- 連絡の定義・ひな形・種類: `src/features/core/messaging/README.md`
