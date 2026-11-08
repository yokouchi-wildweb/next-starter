# src/config — プロジェクトが上流の既定を上書きする場所

既定値と型は持ち主(地区 = lib・ドメイン・枠・proxies)の `config.ts` に置き、`src/config` にはプロジェクト(fork)が変えたい値だけを書く上書きを置きます。上流は持ち主ごとに空の上書きを出荷し、fork は変えたい所だけ中身を書きます。地区の定義: [src/lib/districtMap/README.md](../lib/districtMap/README.md)。

## 4 つの種類のフォルダ(中は平ら)

| フォルダ | 持ち主 | 上書き | 持ち主の既定 |
|---|---|---|---|
| `lib/` | `src/lib/<名前>` | `lib/<名前>.config.ts` | `src/lib/<名前>/config.ts`(`@lib-config/<名前>` で読む。[src/lib/README.md](../lib/README.md)) |
| `features/` | ドメイン(`src/features/<名前>`・`src/features/core/<名前>`) | `features/<名前>.config.ts` | `<ドメイン>/config.ts` |
| `layout/` | 枠(`src/app/**/_layout/config.ts` の `frame: "<名前>"`) | `layout/<名前>.config.ts` | `<_layout>/config.ts` |
| `proxies/` | `src/proxies`(1 つ) | `proxies/proxies.config.ts` | `src/proxies/config.ts` |

- 名前 = 地区の名前(フォルダ名、枠は `frame:` の宣言)。話題などでフォルダを分けない
- 描画専用の値(アイコン・部品など)を持つ持ち主だけ、2 本目 `<名前>.ui.config.ts` を並べる(持ち主の側は `config.ui.ts`)

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

## 読むのは持ち主だけ(lint `config-overrides/owner-reads-only`、全 Tier error)

上書きを import できるのは持ち主の `config.ts`(`<名前>.ui.config.ts` は `config.ui.ts`)だけ。型だけの import も同じ。他のコードは持ち主の入口から確定した値を読みます。lib の中は lint `lib-entry`(`@lib-config/<自分>` だけ)が見ます。

## 移行中のもの

`app/`・`ui/`・`documents/` と直下の `business.config.ts`・`seo.config.ts` は古い置き場です。値は各持ち主の `config.ts` と上の 4 つのフォルダへ移り、空になったら消えます(新しい値をここに足さない)。1 対 1 の検査はこれらを見ません。
