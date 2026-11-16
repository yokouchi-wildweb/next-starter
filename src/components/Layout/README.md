# Layout コンポーネント

## コンポーネント選択ガイド

### Block / Flex / Stack の使い分け

| コンポーネント | 目的 | 使用場面 |
|--------------|------|---------|
| Block | シンプルなラッパー | レイアウト制御不要、余白やappearanceのみ必要 |
| Flex | 配置制御 | 横並び、中央揃え、justify/alignが必要 |
| Stack | 縦方向の余白制御 | 子要素間に一定の縦余白を設けたい（space-yの代替、`gap`）|

**よくある誤用**:
- 単なるdivラッパーにFlex → Blockを使用
- 縦並びで余白だけ必要なのにFlex → Stackを使用
- レイアウト不要なのにStack → Blockを使用

### 全コンポーネント一覧

| コンポーネント | 出力要素 | 用途 |
|--------------|---------|------|
| Block | div | シンプルなブロック要素 |
| InBlock | span | インラインブロック要素 |
| Flex | div | Flexboxレイアウト（配置制御） |
| Stack | div | 縦方向スタック（余白制御特化） |
| Grid | div | CSSグリッドレイアウト |
| Section | section等 | セマンティックセクション（as propで要素変更可） |
| Main | main | ページメインコンテンツ（containerTypeで幅制御） |
| FullScreen | div | フルスクリーン表示（モバイル対応） |
| ScaledStage | div | 固定の論理 W×H を transform:scale でコンテナにフィット（レターボックス） |
| Hidden | div | 非表示要素（display: none） |

### 共通props

全コンポーネント共通: `appearance`, `padding`, `paddingBlock`, `paddingInline`, `margin`, `marginBlock`, `marginInline`(余白の値は下の「余白」)

`ref`: Block / InBlock / Flex / Stack / Grid / Section / Main / Hidden は出力要素への `ref` を受け取る（React 19 の ref は props として渡る）。外部ライブラリが描画先の要素を要する場合（カメラのプレビュー等）も生の div を使わずこれらに `ref` を渡す。Main の `ref` はどの containerType でも `<main>` 要素を指す

### 余白

Layout 部品の余白 prop は 1 つの段の名前で受ける。同じ名前は部品が違っても同じ大きさ(同じトークン)。

| 名前 | px | トークン |
|---|---|---|
| `none` | 0 | `--space-none` |
| `2xs` | 4 | `--space-2xs` |
| `xs` | 8 | `--space-xs` |
| `sm` | 12 | `--space-sm` |
| `md` | 16 | `--space-md` |
| `lg` | 24 | `--space-lg` |
| `xl` | 32 | `--space-xl` |
| `2xl` | 40 | `--space-2xl` |
| `3xl` | 48 | `--space-3xl` |
| `4xl` | 64 | `--space-4xl` |

- 名前と px の正は `spacingScale.ts`。トークンは `src/styles/core/config.css` の `:root`(fork は直下の CSS で値を上書きできる。`@theme` の `--spacing` は使わないので `p-4`・`max-w-2xl` などの数値の class は動かない)
- 余白 prop: `padding`・`paddingBlock`・`paddingInline`・`margin`・`marginBlock`・`marginInline`(全部品)、`gap`(Flex・Grid・Stack)、`gapX`・`gapY`(Grid。gap より後に効く)
- 値は名前か、画面幅ごとのオブジェクト `{ base, sm, md, lg, xl, "2xl" }`(どれも省略可。`base` = 幅の指定なし、ほかは Tailwind の画面幅の接頭辞と同じ):
  ```tsx
  <Stack gap="md">…</Stack>
  <Flex gap={{ base: "xs", md: "lg" }}>…</Flex>
  <Main padding={{ base: "md", sm: "lg" }}>…</Main>
  ```
- 既定値: Flex・Grid・Stack の `gap` = `none`。Main の `padding` = `{ base: "sm", sm: "md" }`(12px → 画面幅 sm 以上で 16px)。ほかは余白なし
- class は生成した表 `spacingClasses.generated.ts`(`pnpm generate styles`)から引く。`gap-${n}` のような組み立てはしない(Tailwind は字面に現れた class しか CSS にしない)。表の class が全部ビルドの CSS にあるかは `pnpm check styles`(`pnpm build` の末尾)が確かめる
- 段に無い大きさ・部品の内側の余白は `className` に数値の class で書く(`gap-5`・`p-1` 等。`className` は prop の class より勝つ)。部品の内側の余白は size のバリアントで変え、段では動かさない
- 型: `SpacingValue`・`SpacingName`・`BoxSpacingProps`(`@/components/Layout`)。中継する部品の prop も `SpacingValue` で受ける(例: AppForm の `fieldSpace`)

#### 旧名 → 新名(移行中)

旧い名前は部品ごとに大きさが違い、新しい名前と重なる(`sm`・`md` など)。手で書き換えず codemod `.notices/20261116-134913-spacing-scale.spacing-scale.mjs` を `--base <書き換え前のコミット>` で走らせる。対応(画面幅ごとの px は旧と同じ):

<!-- spacing-scale:mapping start (codemod の対応表から作る。手で直さない) -->
| 部品・prop | 旧名 → 新名(同じ px) |
|---|---|
| 全部品の padding | none → none / xs → 2xs / sm → xs / md → {base:sm, sm:md} / lg → {base:md, sm:lg} / xl → {base:lg, sm:2xl} / xxl → {base:2xl, sm:4xl} / xxxl → className `p-16 sm:p-24` |
| 全部品の paddingBlock | none → none / xs → 2xs / sm → xs / md → {base:sm, sm:md} / lg → {base:md, sm:lg} / xl → {base:lg, sm:2xl} / xxl → {base:2xl, sm:4xl} / xxxl → className `py-16 sm:py-24` |
| 全部品の paddingInline | none → none / xs → 2xs / sm → xs / md → {base:sm, sm:md} / lg → {base:md, sm:lg} / xl → {base:lg, sm:2xl} / xxl → {base:2xl, sm:4xl} / xxxl → className `px-16 sm:px-24` |
| 全部品の margin | none → none / xs → 2xs / sm → xs / md → md / lg → lg / xl → 2xl / xxl → 4xl / xxxl → className `m-24` |
| 全部品の marginBlock | none → none / xs → 2xs / sm → xs / md → md / lg → lg / xl → 2xl / xxl → 4xl / xxxl → className `my-24` |
| 全部品の marginInline | none → none / xs → 2xs / sm → xs / md → md / lg → lg / xl → 2xl / xxl → 4xl / xxxl → className `mx-24` |
| Grid の gap | none → none / xs → 2xs / sm → xs / md → md / lg → lg / xl → xl / xxl → 3xl |
| Grid の columnGap → gapX | none → (prop を外す) / xs → 2xs / sm → xs / md → md / lg → lg / xl → xl / xxl → 3xl |
| Grid の rowGap → gapY | none → (prop を外す) / xs → 2xs / sm → xs / md → md / lg → lg / xl → xl / xxl → 3xl |
| Flex の gap | none → none / xs → xs / sm → md / md → lg / lg → xl / xl → 3xl / xxl → 4xl |
| Stack の space → gap | 0 → none / 1 → 2xs / 2 → xs / 3 → sm / 4 → md / 5 → className `gap-5` / 6 → lg / 7 → className `gap-7` / 8 → xl / 9 → className `gap-9` / 10 → 2xl / 11 → className `gap-11` / 12 → 3xl / 14 → className `gap-14` / 16 → 4xl / 20 → className `gap-20` / 24 → className `gap-24` / 28 → className `gap-28` / 32 → className `gap-32` / 36 → className `gap-36` / 40 → className `gap-40` / 44 → className `gap-44` / 48 → className `gap-48` / 52 → className `gap-52` / 56 → className `gap-56` / 60 → className `gap-60` / 64 → className `gap-64` / 72 → className `gap-72` / 80 → className `gap-80` / 96 → className `gap-96` / 0.5 → className `gap-0.5` / 1.5 → className `gap-1.5` / 2.5 → className `gap-2.5` / 3.5 → className `gap-3.5` |
<!-- spacing-scale:mapping end -->

### 詳細

#### Section
`as` propで出力要素を変更可能: `section`（default）, `article`, `aside`, `nav`, `header`, `footer`
選び方は HTML の意味で決める（独立した単位 → `article`、補足 → `aside`、ナビ → `nav`、それ以外 → `section`。生タグは書かない）: `docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md` §4

#### Main
`containerType`で幅を制御:
- `plain`: 幅制限なし
- `narrowStack`: 狭い幅（フォーム等）
- `contentShell`: 標準幅（default）
- `wideShowcase`: 広い幅
- `fullscreen`: フルスクリーン

`verticalAlign`でコンテンツの縦位置を制御(`plain`・`fullscreen` 以外の型で効く):
- `center`: 余白があれば縦中央寄せ（default。ログイン・エラー等の短いページ向け）
- `start`: 上揃え（縦に長いコンテンツのページ向け）

部位の印 `data-slot`(fork の CSS が狙う名前): `<main>` = `main`、`plain`・`fullscreen` 以外の外側の 2 段 = `main-container` / `main-layout`。Main は id(呼び手が渡した時だけ `<main>` に付く)・`data-component` を持たない。一覧: [src/app/(user)/_layout/README.md](../../app/(user)/_layout/README.md)「data-slot の一覧」

#### FullScreen
モバイルブラウザのアドレスバーを考慮した真のフルスクリーン表示。`layer` propでz-index層を指定。
高さは `var(--viewport-height, 100dvh)` を読むだけで、自分では計測しない(書き手は root layout の `ViewportHeightWatcher`、[src/lib/viewport](../../lib/viewport/README.md))。

#### ScaledStage
`logicalWidth` × `logicalHeight` の論理 px で組んだ子を、コンテナに収まる倍率で transform:scale する（`useFitScale` を内蔵、"use client"）。`fit`: `contain`（既定、レターボックス）/ `width` / `height`、`minScale` / `maxScale`、`align`、`overflow`。サイネージ・キオスク・固定比率の盤面など「カンプ忠実」が優先される画面向け。流体レイアウトとの使い分けと詳細は [AppFrames/Kiosk/README.md](../AppFrames/Kiosk/README.md)。
