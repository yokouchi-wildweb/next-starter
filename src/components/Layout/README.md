# Layout

## Overview

- レイアウトの包み部品の群。入口は `@/components/Layout`
- 使う時・直す時の決まりは札 .claude/rules/items/components/Layout.md にある。この README は使い方と仕組み

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

## Usage

Block / Flex / Stack の使い分け:

| コンポーネント | 目的 | 使用場面 |
|--------------|------|---------|
| Block | シンプルなラッパー | レイアウト制御不要、余白やappearanceのみ必要 |
| Flex | 配置制御 | 横並び、中央揃え、justify/alignが必要 |
| Stack | 縦方向の余白制御 | 子要素間に一定の縦余白を設けたい（space-yの代替、`gap`）|

余白の指定:

```tsx
<Stack gap="md">…</Stack>
<Flex gap={{ base: "xs", md: "lg" }}>…</Flex>
<Main padding={{ base: "md", sm: "lg" }}>…</Main>
```

- 段に無い大きさは `className` に数値の class で書く(`gap-5`・`p-1` 等)

## API

### 共通props

- 全コンポーネント共通: `appearance`, `padding`, `paddingBlock`, `paddingInline`, `margin`, `marginBlock`, `marginInline`(余白の値は下の「余白」)
- `ref`: Block / InBlock / Flex / Stack / Grid / Section / Main / Hidden は出力要素への `ref` を受け取る（React 19 の ref は props として渡る）。Main の `ref` はどの containerType でも `<main>` 要素を指す

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

- 余白 prop: `padding`・`paddingBlock`・`paddingInline`・`margin`・`marginBlock`・`marginInline`(全部品)、`gap`(Flex・Grid・Stack)、`gapX`・`gapY`(Grid。gap より後に効く)
- 値は名前か、画面幅ごとのオブジェクト `{ base, sm, md, lg, xl, "2xl" }`(どれも省略可。`base` = 幅の指定なし、ほかは Tailwind の画面幅の接頭辞と同じ)
- 既定値: Flex・Grid・Stack の `gap` = `none`。Main の `padding` = `{ base: "sm", sm: "md" }`(12px → 画面幅 sm 以上で 16px)。ほかは余白なし
- `className` の class は prop の class より勝つ
- 型: `SpacingValue`・`SpacingName`・`BoxSpacingProps`(`@/components/Layout`)

### Section

`as` propで出力要素を変更可能: `section`（default）, `article`, `aside`, `nav`, `header`, `footer`。HTML の意味での選び方: `docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md` §4

### Main

`containerType`で幅を制御:
- `plain`: 幅制限なし
- `narrowStack`: 狭い幅（フォーム等）
- `contentShell`: 標準幅（default）
- `wideShowcase`: 広い幅
- `fullscreen`: フルスクリーン

`verticalAlign`でコンテンツの縦位置を制御(`plain`・`fullscreen` 以外の型で効く):
- `center`: 余白があれば縦中央寄せ（default。ログイン・エラー等の短いページ向け）
- `start`: 上揃え（縦に長いコンテンツのページ向け）

### FullScreen

モバイルブラウザのアドレスバーを考慮した真のフルスクリーン表示。`layer` prop でページの層(`@/lib/zLayer` の `PageLayerName`: background … forefront、既定 above-header)を指定。浮く物・toast・cover の層は選べない。

### ScaledStage

`logicalWidth` × `logicalHeight` の論理 px で組んだ子を、コンテナに収まる倍率で transform:scale する（`useFitScale` を内蔵、"use client"）。`fit`: `contain`（既定、レターボックス）/ `width` / `height`、`minScale` / `maxScale`、`align`、`overflow`。サイネージ・キオスク・固定比率の盤面など「カンプ忠実」が優先される画面向け。流体レイアウトとの使い分けと詳細は [AppFrames/Kiosk/README.md](../AppFrames/Kiosk/README.md)。

## Extension

- 余白の大きさ: トークン `--space-*` は `src/styles/core/config.css` の `:root` にあり、fork は直下の CSS で値を上書きできる
- Main の部位の印 `data-slot`(fork の CSS が狙う名前): `<main>` = `main`、`plain`・`fullscreen` 以外の外側の 2 段 = `main-container` / `main-layout`。Main は id(呼び手が渡した時だけ `<main>` に付く)・`data-component` を持たない。一覧: [src/app/(user)/_layout/README.md](../../app/(user)/_layout/README.md)「data-slot の一覧」

## Internals

- 段の名前と px の正は `spacingScale.ts`。`@theme` の `--spacing` は使わないので、`--space-*` の上書きは `p-4`・`max-w-2xl` などの数値の class には効かない
- class は生成した表 `spacingClasses.generated.ts`(`pnpm generate styles`)から引く。表の class が全部ビルドの CSS にあるかは `pnpm check styles`(`pnpm build` の末尾)が確かめる
- FullScreen の高さは `var(--viewport-height, 100dvh)` を読む。書き手は root layout の `ViewportHeightWatcher`([src/lib/viewport](../../lib/viewport/README.md))
