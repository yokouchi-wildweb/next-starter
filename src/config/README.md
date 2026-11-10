# src/config — プロジェクトが上流の既定を上書きする場所

既定値と型は持ち主(地区 = lib・ドメイン・枠・proxies、と src 直下の基盤)の `config.ts` などに置き、`src/config` にはプロジェクト(fork)が変えたい値だけを書く上書きを置きます。上流は持ち主ごとに空の上書きを出荷し、fork は変えたい所だけ中身を書きます。地区の定義: [src/lib/districtMap/README.md](../lib/districtMap/README.md)。

## 5 つのフォルダ(地区の 4 種 + 基盤の上書き、中は平ら)

| フォルダ | 持ち主 | 上書き | 持ち主の既定 |
|---|---|---|---|
| `lib/` | `src/lib/<名前>` | `lib/<名前>.config.ts` | `src/lib/<名前>/config.ts`(`@lib-config/<名前>` で読む。[src/lib/README.md](../lib/README.md)) |
| `features/` | ドメイン(`src/features/<名前>`・`src/features/core/<名前>`) | `features/<名前>.config.ts` | `<ドメイン>/config.ts` |
| `layout/` | 枠(`src/app/**/_layout/config.ts` の `frame: "<名前>"`) | `layout/<名前>.config.ts` | `<_layout>/config.ts` |
| `proxies/` | `src/proxies` のテーマのフォルダ(`src/proxies/<テーマ>/config.ts`、上流は `demo` だけ) | `proxies/<テーマ>.config.ts` | `src/proxies/<テーマ>/config.ts` |
| `featureGate/` | 基盤 `src/featureGate`(門番。固定) | `featureGate/<中身の名前>.config.ts`(例 `switches.config.ts` = 機能の入切の fork の値) | `src/featureGate` の中(門番の規則のファイル) |

- 名前 = 地区の名前(フォルダ名、枠は `frame:` の宣言)。話題などでフォルダを分けない
- 基盤の上書き(設定 D91): src 直下の基盤(今は `src/featureGate` だけ)の上書きは、その基盤の名前のフォルダに中身の名前のファイルで置く。基盤が別の上書きを持てば同じフォルダに並べる。持ち主は基盤のフォルダに固定で、読めるのはその中のファイルだけ
- `features/` はドメインの値の上書きだけ。機能(門番の規則)の入切の fork の値は `featureGate/switches.config.ts` に書く(既定は門番の規則のファイル、設定 D92)
- 描画専用の値(アイコン・部品など)を持つ持ち主だけ、2 本目 `<名前>.ui.config.ts` を並べる(持ち主の側は `config.ui.ts`)
- **受け口か config か**: fork が互いに独立した行を足していく一覧(例: 転送の規則)は受け口(`extensionPoints.ts` の点、1 ファイル = 1 項目)。鍵で合わせて値を変える表(例: 通貨・区分)は config(上書きで鍵ごとに重ねる)

## 1 対 1

- 上書きと持ち主はちょうど 1 本ずつ揃える。持ち主の無い上書き(余り)と、`config.ts` があるのに上書きが無い(欠落)は `pnpm check config-overrides` が落とす(門 build・ship)。中身: [scripts/structure/config-overrides/README.md](../../scripts/structure/config-overrides/README.md)
- 上流は持ち主の `config.ts` と空の上書きを同じ commit で作る。持ち主を消す・改名するときは上書きも同じ commit で消す・改名する

## 上書きの中身(lint `config-overrides/literal-only`、全 Tier error)

- ファイルに書けるのは import・`export default`(値 1 つ)・型の宣言だけ。空の上書きは `export default {} satisfies <持ち主の上書きの型>;`
- 値はリテラル: object・配列・文字列・数・真偽・null・式の無い template・`as const`・`satisfies`。関数・メソッド・呼び出し・`new`・spread・変数(`const`)・`export const` は書けない
- リテラル以外に読んでよいもの:
  - 型(`import type`、どこからでも)
  - `process.env.<名前>` と、それを比べる・切り替える式(`===`・`!==`・`??`・`||`・`&&`・`? :`)。client から読まれる設定に env を使うなら `NEXT_PUBLIC_` の付く名前でないと client では読めない
  - `@/business`(事業の素性)の値
  - 段階の判定 `isProduction()`・`isStaging()`・`isDevelopment()`・`getAppEnv()`(`@/lib/appEnv` から、引数なしの呼び出しだけ。`process.env.APP_ENV` を直に読まない)
  - 持ち主が宣言した指定子の値(下)
- fork 独自のキーは上書きの中で `export type Extra` を宣言し、持ち主の型引数で受ける

### 持ち主の宣言 `overrideImports`

リテラルで渡せない物(フォント・アイコンの部品・SDK の値)を受ける持ち主だけ、自分の `config.ts` に許す指定子を宣言します(前方一致、字面で読む)。部品(React)は値の `config.ts` に書けないので、部品の宣言は描画用の `config.ui.ts` に置き、`<名前>.ui.config.ts` でだけ効きます。

```ts
// src/features/core/wallet/config.ui.ts(持ち主の描画用)
export const overrideImports = ["react-icons/fa", "@/components/Icons"] as const;
```

- 宣言は上流(持ち主)の物で、上書きの中に書いても広がらない。処理(features の関数など)は宣言できず、上書きに書けない

### 持ち主の宣言 `featureRequirements`(機能を要する値、設定 D107・D110)

設定の値が別の機能を前提にする(例 購入に SMS 認証を必須にする)なら、持ち主の config.ts にリテラルで宣言します。合成した値(既定 + この上書き)が `off` でないのに機能が閉なら、門 build の `pnpm check proxies` が失敗し、直し方 2 つ(機能を開ける / 上書きに `off` を書く)を出します。

```ts
import type { FeatureRequirement } from "@/featureGate";
export const featureRequirements = [
  { key: "purchaseRestriction", feature: "phoneVerification", off: "none" },
] as const satisfies readonly FeatureRequirement[];
```

- `key` = 合成した設定の点区切りの鍵、`feature` = 門番の機能の名前、`off` = その機能を使わない値、`element: true` = 値が配列で、要素に `off` 以外があれば要する
- 宣言するのは本当にその機能を要する値だけ(候補の一覧に入っているだけの物は書かない)。fork が足した持ち主も宣言できる。上書きの側には書かない
- 読み手は地区の地図(`src/lib/districtMap`、欄 `featureRequirements`)、判定は門番の検査 `src/featureGate/checks/featureRequirements.ts`
- 上流の宣言: wallet の `purchaseRestriction` → `phoneVerification`(off `"none"`)、proxies の demo の `enabled` → `demoPages`(off `false`)

## 読むのは持ち主だけ(lint `config-overrides/owner-reads-only`、全 Tier error)

上書きを import できるのは持ち主の `config.ts`(`<名前>.ui.config.ts` は `config.ui.ts`)だけ。型だけの import も同じ。基盤の上書き(`featureGate/`)は持ち主のフォルダ(`src/featureGate`)の中のファイルだけが読めます。他のコードは持ち主の入口から確定した値を読みます。lib の中は lint `lib-entry`(`@lib-config/<自分>` だけ)が見ます。

## 機能の入切の道具

機能の入切の fork の値は `featureGate/switches.config.ts`(上流は空で出荷、`{ <機能の名前>: true|false }`、型 `FeatureSwitches`)。既定は門番の規則のファイルの `defaultEnabled`(設定 D92・門番 D35)。`pnpm ops features set <規則名> on|off` が fork ではここに書く(既定と同じ値でも消さない。詳細: [src/featureGate/README.md](../featureGate/README.md)「pnpm ops features list / pnpm ops features set」)

## 移行中のもの

`app/`・`ui/` と直下の `business.config.ts` は古い置き場です(`business.config.ts` は `@/business` を写す殻。法務の文書は `features/legal.config.ts`(持ち主 `src/features/core/legal`)へ移った。事業の素性の正本は [src/lib/business/README.md](../lib/business/README.md))。値は各持ち主の `config.ts` と上の 5 つのフォルダへ移り、空になったら消えます(新しい値をここに足さない)。1 対 1 の検査はこれらを見ません。
