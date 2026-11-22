# src/config — プロジェクトが上流の既定を上書きする場所

## Overview

既定値と型は持ち主(地区 = lib・ドメイン・枠・proxies、と src 直下の基盤)の `config.ts` などに置き、`src/config` にはプロジェクト(fork)が変えたい値だけを書く上書きを置きます。上流は持ち主ごとに空の上書きを出荷し、fork は変えたい所だけ中身を書きます。地区の定義: [src/lib/districtMap/README.md](../lib/districtMap/README.md)。

### 5 つのフォルダ(地区の 4 種 + 基盤の上書き、中は平ら)

| フォルダ | 持ち主 | 上書き | 持ち主の既定 |
|---|---|---|---|
| `lib/` | `src/lib/<名前>` | `lib/<名前>.config.ts` | `src/lib/<名前>/config.ts`(`@lib-config/<名前>` で読む。[src/lib/README.md](../lib/README.md)) |
| `domains/` | ドメイン(`src/domains/<名前>`・`src/domains/core/<名前>`) | `domains/<名前>.config.ts` | `<ドメイン>/config.ts` |
| `layout/` | 枠(`src/app/**/_layout/config.ts` の `frame: "<名前>"`) | `layout/<名前>.config.ts` | `<_layout>/config.ts` |
| `proxies/` | `src/proxies` のテーマのフォルダ(`src/proxies/<テーマ>/config.ts`、上流は持たない、fork が足すテーマ) | `proxies/<テーマ>.config.ts` | `src/proxies/<テーマ>/config.ts` |
| `featureGate/` | 基盤 `src/featureGate`(門番。固定) | `featureGate/<中身の名前>.config.ts`(例 `switches.config.ts` = 機能の入切の fork の値) | `src/featureGate` の中(門番の規則のファイル) |

- 名前 = 地区の名前(フォルダ名、枠は `frame:` の宣言)。話題などでフォルダを分けない
- 基盤の上書き: src 直下の基盤(今は `src/featureGate` だけ)の上書きは、その基盤の名前のフォルダに中身の名前のファイルで置く。基盤が別の上書きを持てば同じフォルダに並べる。持ち主は基盤のフォルダに固定で、読めるのはその中のファイルだけ
- `domains/` はドメインの値の上書きだけ。機能(門番の規則)の入切の fork の値は `featureGate/switches.config.ts` に書く(既定は門番の規則のファイル)
- 描画専用の値(アイコン・部品など)を持つ持ち主だけ、2 本目 `<名前>.ui.config.ts` を並べる(持ち主の側は `config.ui.ts`)
- **受け口か config か**: fork が互いに独立した行を足していく一覧(例: 転送の規則)は受け口(`extensionPoints.ts` の点、1 ファイル = 1 項目)。鍵で合わせて値を変える表(例: 通貨・区分)は config(上書きで鍵ごとに重ねる)

## Usage

### 1 対 1

- 上書きと持ち主はちょうど 1 本ずつ揃える。持ち主の無い上書き(余り)と、`config.ts` があるのに上書きが無い(欠落)は `pnpm check config-overrides` が落とす(gate の build・ship・forge:post)。中身: [scripts/structure/config-overrides/README.md](../../scripts/structure/config-overrides/README.md)
- 上流は持ち主の `config.ts` と空の上書きを同じ commit で作る。持ち主を消す・改名するときは上書きも同じ commit で消す・改名する

### 上書きの中身(lint `config-overrides/literal-only`、全 Tier error)

- ファイルに書けるのは import・`export default`(値 1 つ)・型の宣言だけ。空の上書きは `export default {} satisfies <持ち主の上書きの型>;`
- 値はリテラル、または env を読むだけの関数
  - リテラル: object・配列・文字列・数・真偽・null・undefined・単項の `-` `+` `!`・式の無い template・`as const`・`satisfies`
  - env を読むだけの関数: 引数なしの矢印関数で、本体が式の `process.env.<名前>`、またはそれを `??` / `||` でつないだ形(右端だけリテラルの既定可)。例 `serviceAccountKey: () => process.env.MY_SERVICE_ACCOUNT_KEY`。呼んだ時に読む値(server だけの秘密など)を持ち主が関数の型で受けるときに使う
  - それ以外の関数・メソッド・呼び出し・`new`・spread・変数(`const`)・`export const` は書けない
- リテラル以外に読んでよいもの:
  - 型(`import type`、どこからでも)
  - `process.env.<名前>` と、それを比べる・切り替える式(`===`・`!==`・`==`・`!=`・`??`・`||`・`&&`・`? :`)。client から読まれる設定に env を使うなら `NEXT_PUBLIC_` の付く名前でないと client では読めない
  - `@/business`(事業の素性)の値
  - 段階の判定 `isProduction()`・`isStaging()`・`isDevelopment()`・`getAppEnv()`(`@/lib/appEnv` から、引数なしの呼び出しだけ。`process.env.APP_ENV` を直に読まない)
  - 持ち主が宣言した指定子の値(下)
- fork 独自のキーは上書きの中で `export type Extra` を宣言し、持ち主の型引数で受ける | Extra は既定の型と深く合成される: 既定の配列の項目に欄を足すのも Extra で書ける(`{ payment: { paymentMethods: (PaymentMethodConfig & { bonus?: … })[] } }`)。決まり: src/lib/defineConfig/README.md「Extra」

### 読むのは持ち主だけ(lint `config-overrides/owner-reads-only`、全 Tier error)

上書きを import できるのは持ち主の `config.ts`(`<名前>.ui.config.ts` は `config.ui.ts`)だけ。型だけの import も同じ。基盤の上書き(`featureGate/`)は持ち主のフォルダ(`src/featureGate`)の中のファイルだけが読めます。他のコードは持ち主の入口から確定した値を読みます。lib の中は lint `entry/only-entries`(`@lib-config/<自分>` だけ)が見ます。

### 機能の入切の道具

機能の入切の fork の値は `featureGate/switches.config.ts`(上流は空で出荷、`{ <機能の名前>: true|false }`、型 `FeatureSwitches`)。既定は門番の規則のファイルの `defaultEnabled`。`pnpm ops features set <規則名> on|off` が fork ではここに書く(既定と同じ値でも消さない。詳細: [src/featureGate/README.md](../featureGate/README.md)「pnpm ops features list / pnpm ops features set」)

### fork に残る古い app/・ui/

上流は `app/`・`ui/` を持ちません(値は持ち主の `config.ts` と上の 5 つのフォルダの上書きへ移った。移し先の表は区切り config-close の notice)。1 対 1 の検査は fork に残る古いフォルダを見ません。事業の素性は `@/business`([src/lib/business/README.md](../lib/business/README.md))、法務の文書の値は `domains/legal.config.ts`。

fork が `app/`・`ui/` に足したファイルと鍵の行き先(どれか 1 つ、値の意味で決める):

- 画面・API を開け閉めする入切 → fork の門番の規則(`src/featureGate/rules/<名前>.ts` の `defaultEnabled`、住所 `pathPatterns`)と `featureGate/switches.config.ts`。env で決まる入切(資格情報の有無など)は規則の `enabled()` に書く
- fork の業務の値 → その業務ドメインの `config.ts`(上書き `domains/<ドメイン>.config.ts`)。持ち主が 1 つに決まらない値は表なしの fork のドメインを作ってそこへ
- 上流の持ち主に fork が足す鍵 → その上書きの `Extra`(上の「上書きの中身(lint `config-overrides/literal-only`、全 Tier error)」)。枠の値は `layout/<枠>.config.ts` の `Extra`、枠の部品を出さないのは slot の `null`(枠の 1 行スイッチの先)
- 上流の機能の一部を消す・隠すだけの鍵 → 機能を閉じる(`pnpm ops features set <名前> off`)か、上流の上書きの既存の鍵

## Extension

### 持ち主の宣言 `overrideImports`

リテラルで渡せない物(フォント・アイコンの部品・SDK の値)を受ける持ち主だけ、自分の `config.ts` に許す指定子を宣言します(前方一致、字面で読む)。部品(React)は値の `config.ts` に書けないので、部品の宣言は描画用の `config.ui.ts` に置き、`<名前>.ui.config.ts` でだけ効きます。

```ts
// src/domains/core/wallet/config.ui.ts(持ち主の描画用)
export const overrideImports = ["lucide-react"] as const;
```

- 宣言は上流(持ち主)の物で、上書きの中に書いても広がらない。処理(features の関数など)は宣言できず、上書きに書けない

### 持ち主の宣言 `overrideLoaders`(値に書けないローダーの呼び出し)

書体の next/font のように、モジュールのトップレベルでリテラルの引数で呼んだ結果を渡す物を受ける持ち主だけ、描画用の `config.ui.ts` にローダーの指定子を宣言します(前方一致、字面で読む)。その持ち主の上書きでだけ、宣言した指定子から読んだ名前を `const <名前> = <ローダー>(<リテラルの引数>)` の 1 文で呼べ、その名前を `export default` の値で読めます(lint `config-overrides/literal-only`)。

```ts
// src/lib/fonts/config.ui.ts(持ち主の描画用)
export const overrideLoaders = ["next/font/google", "next/font/local"] as const;

// src/config/lib/fonts.ui.config.ts(上書き)
import { Noto_Sans_JP } from "next/font/google";
import type { FontsOverride } from "@/lib/fonts";
const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-loaded", display: "swap" });
export default { sans } satisfies FontsOverride;
```

- 上流の宣言は lib/fonts の 1 か所だけ。引数に変数・呼び出しは書けず、`let`・複数の宣言・`export default` の中での呼び出しは止まる

### 持ち主の宣言 `featureRequirements`(機能を要する値)

設定の値が別の機能を前提にする(例 購入に SMS 認証を必須にする)なら、持ち主の config.ts にリテラルで宣言します。合成した値(既定 + この上書き)が `off` でないのに機能が閉なら、build のゲートで走る `pnpm check proxies` が失敗し、直し方 2 つ(機能を開ける / 上書きに `off` を書く)を出します。

```ts
import type { FeatureRequirement } from "@/featureGate";
export const featureRequirements = [
  { key: "purchaseRestriction", feature: "phoneVerification", off: "none" },
] as const satisfies readonly FeatureRequirement[];
```

- `key` = 合成した設定の点区切りの鍵、`feature` = 門番の機能の名前、`off` = その機能を使わない値、`element: true` = 値が配列で、要素に `off` 以外があれば要する
- 宣言するのは本当にその機能を要する値だけ(候補の一覧に入っているだけの物は書かない)。fork が足した持ち主も宣言できる。上書きの側には書かない
- 読み手は地区の地図(`src/lib/districtMap`、欄 `featureRequirements`)、判定は門番の検査 `src/featureGate/checks/featureRequirements.ts`
- 上流の宣言: wallet の `purchaseRestriction` → `phoneVerification`(off `"none"`)、demo の `mode.enabled` → `demoPages`(off `false`)
