# TextBlocks

文章構造のラッパー。生の `h1` / `h2` / `p` の代わりに使う（CLAUDE.md COMPONENTS wrappers）。

| コンポーネント | 要素 | 既定値（tone / size / weight / align） | base クラス |
| --- | --- | --- | --- |
| `PageTitle` | `h1` | inherit / xxl / bold / left | `tracking-tight` |
| `SecTitle` | `h2`（`as` で h1〜h6） | inherit / xl / bold / left | なし |
| `Para` | `p` | inherit / md / normal / left | `my-2 leading-relaxed` |
| `Span` | `span` | inherit / md / normal / なし | `inline-block leading-relaxed` |

画面の h1 は `src/app/(user)/_layout/PageTitle`（`UserPageTitle`）など、フレーム側のタイトル部品を使う。

## 見出しの印（data-slot）

- `PageTitle` の h1 は `data-slot="page-title"`、`SecTitle` の見出しは `data-slot="sec-title"` を持つ。fork の CSS はこの印で狙う（`[data-slot="page-title"]`。約束の一覧 = `src/app/_layout/frame/parts.mjs` の見出し、`src/styles/README.md`「data-slot の付け方」）
- 部品自身の印が勝つ: 呼び手が props で渡した `data-slot` は上書きされる。`srOnly` でも印は残る
- `slot` prop（`PageTitle`: `"page-title" | "admin-page-title"`、`SecTitle`: `"sec-title" | "admin-sec-title"`）は、同じ要素を描く上流の包む部品（管理の `AdminPageTitleHeading`・`AppFrames/Admin/Elements/SecTitle`）が自分の名前を付けるためだけのもの。fork は名前を変えず、印を狙って見た目を変える
- 印を消す・名前を変えるのは notice。照合: `pnpm test src/components/TextBlocks/headingSlots.test.tsx`

## バリアント

`textVariants.ts` の `tone` / `size` / `weight` / `align` / `srOnly`。

- 見た目の上書き口: `src/config/ui/variants.config.ts` の `pageTitle` / `para` / `secTitle` / `span`（`base` / `tone` / `size` / `weight` / `align`、`srOnly` は上書きしない）。既定のクラスの後ろ・呼び手の `className` の前に足す。値の名前は `@/lib/variantOverrides` の型、キーの一覧: `src/styles/README.md`「バリアントの上書き」。照合: `pnpm test src/components/TextBlocks/variantOverrides.test.tsx`

- `tone`: 文字色。意味色は本文用トークン（`text-x-text`）に解決する。`inherit` は `text-inherit`
- `size`: `xs`〜`xxxl`、流体サイズ `fluidXs`〜`fluidXxxl`（キオスク向け）、`inherit`
- `weight`: `thin`〜`black`、`inherit`
- `align`: `left` / `center` / `right` / `justify` / `centerToStartSm`、`inherit`

### `inherit`（親の値をそのまま使う）

`size` / `weight` / `align` の `inherit` はクラスを何も出さない。`Span` / `Para` で `size="inherit"` を指定すると、行間も親に合わせる（`leading-[inherit]`）。

既定値（`md` / `normal` / `left`）は**生のタグと違って親から受け継がない**。次の 2 つの場面で問題になる。

1. **見出しの中の `Span`**: 既定の `text-base font-normal` が見出しの大きさ・太さを上書きし、文字が小さく細くなる
   ```tsx
   // NG: 16px / 通常の太さになる
   <UserPageTitle><Span className="bg-clip-text text-transparent …">メンテナンス中</Span></UserPageTitle>
   // OK: 見出しの大きさ・太さ・行間のまま
   <UserPageTitle><Span size="inherit" weight="inherit" className="bg-clip-text text-transparent …">メンテナンス中</Span></UserPageTitle>
   ```
   eslint `style-tokens/span-in-heading` が、見出し（`*PageTitle` / `*SecTitle` / 生の h1〜h6）の**直下**にある `Span` で `size` / `weight` の無いものを検出する（upstream 所有の UI は error、下流の画面は warn）。
2. **中央寄せの親の中の `Para`**: 既定の `text-left` が親の `text-center` を打ち消し、`Stack` などの縦並びの中では全幅になって左寄せで表示される
   ```tsx
   <Stack space={2} className="text-center">
     <Para align="center">…</Para>   {/* または align="inherit" */}
   </Stack>
   ```
   親の className は静的に判定できないので lint では検出しない。生の `<p>` を `Para` に置き換えるときは、親の text-align を確認する。

## 注意

- `Span` / `Para` の base の `leading-relaxed` は、`size` が行間付きのサイズクラス（`text-base` 等）を出すと tailwind-merge によって落ちる（サイズクラスの行間が効く）。行間を変えたいときは `className` に `leading-*` を書く。
