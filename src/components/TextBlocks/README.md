# TextBlocks

## Overview

文章構造のラッパー。生の `h1` / `h2` / `p` の代わりに使う（CLAUDE.md COMPONENTS wrappers）。

| コンポーネント | 要素 | 既定値（tone / size / weight / align） | base クラス |
| --- | --- | --- | --- |
| `PageTitle` | `h1` | inherit / xxl / bold / left | `tracking-tight` |
| `SecTitle` | `h2`（`as` で h1〜h6） | inherit / xl / bold / left | なし |
| `Para` | `p` | inherit / md / normal / left | `my-2 leading-relaxed` |
| `Span` | `span` | inherit / md / normal / なし | `inline-block leading-relaxed` |

- 画面の h1 には `src/app/(user)/_layout/PageTitle`（`UserPageTitle`）など、フレーム側のタイトル部品がある

## Usage

### `Span` の `inline`（文中の一続きの文字）

- `<Span inline>` は `display: inline` で、`size` / `weight` の既定が `inherit`、行間も親に合わせる（`leading-[inherit]`）
- 文の途中の色を変えた語・区切りの字など、親の文字と同じ大きさで改行も文と一緒に流したい所に使う
- `size` / `weight` / `tone` を渡せばそれが出る。既定（`inline` なし）は `inline-block`・`md`・`normal` のまま

### `inherit`（親の値をそのまま使う）

- `size` / `weight` / `align` の `inherit` はクラスを何も出さない。`Span` / `Para` で `size="inherit"` を指定すると、行間も親に合わせる（`leading-[inherit]`）
- 既定値（`md` / `normal` / `left`）は生のタグと違って親から受け継がない。次の 2 つの場面で問題になる

1. 見出しの中の `Span`: 既定の `text-base font-normal` が見出しの大きさ・太さを上書きし、文字が小さく細くなる
   ```tsx
   // NG: 16px / 通常の太さになる
   <UserPageTitle><Span className="bg-clip-text text-transparent …">メンテナンス中</Span></UserPageTitle>
   // OK: 見出しの大きさ・太さ・行間のまま
   <UserPageTitle><Span size="inherit" weight="inherit" className="bg-clip-text text-transparent …">メンテナンス中</Span></UserPageTitle>
   ```
2. 中央寄せの親の中の `Para`: 既定の `text-left` が親の `text-center` を打ち消し、`Stack` などの縦並びの中では全幅になって左寄せで表示される
   ```tsx
   <Stack gap="xs" className="text-center">
     <Para align="center">…</Para>   {/* または align="inherit" */}
   </Stack>
   ```

## API

`textVariants.ts` の `tone` / `size` / `weight` / `align` / `srOnly`。

- `tone`: 文字色。意味色は本文用トークン（`text-x-text`）に解決する。`inherit` は `text-inherit`
- `size`: `xs`〜`xxxl`、流体サイズ `fluidXs`〜`fluidXxxl`（キオスク向け）、`inherit`
- `weight`: `thin`〜`black`、`inherit`
- `align`: `left` / `center` / `right` / `justify` / `centerToStartSm`、`inherit`
- `PageTitle` / `SecTitle` の `slot`（`PageTitle`: `"page-title" | "admin-page-title"`、`SecTitle`: `"sec-title" | "admin-sec-title"`）: 同じ要素を描く上流の包む部品（管理の `AdminPageTitleHeading`・`AppFrames/Admin/Elements/SecTitle`）が自分の名前を付けるための物

## Extension

- 見た目の上書き口: `src/config/ui/variants.config.ts` の `pageTitle` / `para` / `secTitle` / `span`（`base` / `tone` / `size` / `weight` / `align`、`srOnly` は上書きしない）
  - 既定のクラスの後ろ・呼び手の `className` の前に足す
  - 値の名前は `@/lib/variantOverrides` の型、キーの一覧: `src/styles/README.md`「バリアントの上書き」
- 見出しの印（data-slot）: `PageTitle` の h1 は `data-slot="page-title"`、`SecTitle` の見出しは `data-slot="sec-title"` を持つ
  - fork の CSS はこの印で狙う（`[data-slot="page-title"]`）
  - 約束の一覧 = `src/app/_layout/frame/parts.mjs` の見出し、`src/styles/README.md`「data-slot の付け方」

## Internals

- 部品自身の印が勝つ: 呼び手が props で渡した `data-slot` は上書きされる。`srOnly` でも印は残る
- lint `style-tokens/span-in-heading` は、見出し（`*PageTitle` / `*SecTitle` / 生の h1〜h6）の直下にある `Span` で `size` / `weight` の無いものを見る（upstream 所有の UI は error、下流の画面は warn）。親の className は静的に判定できないので、中央寄せの親の `Para` は見ない
- `Span` / `Para` の base の `leading-relaxed` は、`size` が行間付きのサイズクラス（`text-base` 等）を出すと tailwind-merge によって落ちる（サイズクラスの行間が効く）

## Verification

- 見出しの印: `pnpm test src/components/TextBlocks/headingSlots.test.tsx`
- 見た目の上書き口: `pnpm test src/components/TextBlocks/variantOverrides.test.tsx`
