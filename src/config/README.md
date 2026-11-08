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
- 上書きは持ち主の `config.ts`(描画用は `config.ui.ts`)だけが読む。他のコードは持ち主の入口から確定した値を読む

## 1 対 1

- 上書きと持ち主はちょうど 1 本ずつ揃える。持ち主の無い上書き(余り)と、`config.ts` があるのに上書きが無い(欠落)は `pnpm check config-overrides` が落とす(門 build・ship)。中身: [scripts/structure/config-overrides/README.md](../../scripts/structure/config-overrides/README.md)
- 上流は持ち主の `config.ts` と空の上書きを同じ commit で作る。持ち主を消す・改名するときは上書きも同じ commit で消す・改名する

## 上書きの中身

- 持ち主の入口から型だけを読み、値はリテラルで書く。空の上書きは `export default {} satisfies <持ち主の上書きの型>;`
- リテラル以外に読んでよいのは `process.env`・`@/business`(事業の素性)と、持ち主が自分の `config.ts` で宣言した読み込みだけ。client から読まれる設定に env を使うなら `NEXT_PUBLIC_` の付く名前でないと client では読めない
- fork 独自のキーは上書きの中で `export type Extra` を宣言し、持ち主の型引数で受ける

## 移行中のもの

`app/`・`ui/`・`documents/` と直下の `business.config.ts`・`seo.config.ts` は古い置き場です。値は各持ち主の `config.ts` と上の 4 つのフォルダへ移り、空になったら消えます(新しい値をここに足さない)。1 対 1 の検査はこれらを見ません。
