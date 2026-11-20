# Layout

## Overview

- レイアウトの包み部品の群。部品ごとの単位で、`@/components/Layout/<部品>` から読む(例 `@/components/Layout/Stack`)
- 余白の段・型・class の引き当ては lib [src/lib/spacing](../../lib/spacing/README.md)(`@/lib/spacing`)
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
| KioskFrame | div | レイアウトを持たない独立ルート群の、ビューポート固定・非スクロールのページ枠（下の「KioskFrame と 1 画面に収める画面」） |

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

### KioskFrame と 1 画面に収める画面

- UserLayout / AdminLayout の外側に置く独立ルート群で、どの解像度・比率でも 1 画面に収まり、スクロールしない画面を作る
- 想定用途: 卓上タブレット端末(未ログイン・全画面固定)、店舗スタッフ用タブレット、店内サイネージ、チェックイン端末
- 使う時の決まり(子の高さ・スクロール・文字・方式の選び方)は札 .claude/rules/items/components/Layout.md にある

| 部品 | 置き場 | 役割 |
|------|--------|------|
| `KioskFrame` | `@/components/Layout/KioskFrame` | ビューポート固定・overflow-clip のページ枠 |
| `ScaledStage` | `@/components/Layout/ScaledStage` | 固定の論理 W×H を transform:scale でコンテナにフィット(レターボックス) |
| `useFitScale` | `@/hooks/useFitScale` | ScaledStage の倍率計算部分。Canvas / Konva など DOM 以外にも使える |
| `text-fluid-*` | `src/styles/core/theme.css` | clamp(vmin) ベースの流体フォントスケール |
| `portrait:` / `landscape:` / `short:` | Tailwind 組み込み / theme.css | 向き・高さ不足の分岐 |

#### KioskFrame でページ枠を張る

```tsx
// src/app/terminal/layout.tsx
import type { ReactNode } from "react";
import { KioskFrame } from "@/components/Layout/KioskFrame";

export default function TerminalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <KioskFrame wakeLock safeArea>
      {children}
    </KioskFrame>
  );
}
```

- ページ側は `flex-1 min-h-0` で残り高さを受け、スクロールさせたい領域だけに `overflow-y-auto` を付ける

```tsx
// ページ側(例)
<Flex className="min-h-0 flex-1 flex-col">
  <Block className="shrink-0">ヘッダー相当</Block>
  <Block className="min-h-0 flex-1 overflow-y-auto">内部スクロール領域</Block>
  <Block className="shrink-0">操作ボタン行</Block>
</Flex>
```

#### 枠の宣言の fill / FullScreen との使い分け

| 欲しいもの | 使うもの |
|-----------|---------|
| UserLayout 内で、ヘッダー等と共存する非スクロールのページ土台 | ページの隣の枠の宣言(`frame.ts` / `frame.override.ts`)の `page: { fill: true }`(枠も隠すなら `hide`)+ `UserPage`([src/app/(user)/_layout/README.md](../../app/(user)/_layout/README.md)「fill のページ」) |
| AdminLayout 内で、サイドバー等と共存する非スクロールのページ土台 | ページの隣の枠の宣言(`frame.ts` / `frame.override.ts`)の `page: { fill: true }` + `AdminPage`([src/app/admin/_layout/README.md](../../app/admin/_layout/README.md)「AdminPage と PageTitle」) |
| レイアウトを持たない独立ルート群のビューポート固定ページ枠 | `<KioskFrame>` |
| 画面全体を覆う一時的なオーバーレイ(スプラッシュ・背景演出) | `<Main containerType="fullscreen">`(fixed オーバーレイ、z 層、body スクロールロック) |

#### 全画面化ボタン(レシピ)

- `useFullscreen` でページ側に置く(ボタンは画面デザインの一部なので KioskFrame には無い)
- Fullscreen API はユーザー操作イベント内でしか許可されないため、自動で全画面にはできない。端末側のキオスクモード / ホーム画面追加を併用する

```tsx
"use client";
import { useFullscreen } from "@/hooks/useFullscreen";
import { Button } from "@/components/Form/Button";

export function FullscreenToggle() {
  const { isFullscreen, supported, toggle } = useFullscreen();
  if (!supported) return null;
  return (
    <Button variant="ghost" onClick={toggle}>
      {isFullscreen ? "全画面を終了" : "全画面"}
    </Button>
  );
}
```

#### 1 画面に収める 2 つの方式

画面ごとに A / B のどちらかを選ぶ(混在も可)。

| 方式 | 向く画面 | 使うもの |
|------|---------|---------|
| A. 流体(fluid) | テキスト主体、縦横比が変わっても再配置で吸収したい、DOM の操作性(フォーム・スクロール領域)を保ちたい | `flex-1 min-h-0` の比率レイアウト + `text-fluid-*` + `portrait:` / `landscape:` / `short:` + `clamp()` 余白 |
| B. スケール(fit-scale) | デザインカンプ忠実、固定比率の盤面・サイネージ、座標データを持つキャンバス | `<ScaledStage logicalWidth logicalHeight>`(または `useFitScale`) |

#### A. 流体レイアウトの書き方

- 文字: `text-fluid-xs` 〜 `text-fluid-5xl`。`clamp(下限, N vmin, 上限)` なので短辺に比例して縮み、縦横どちらでも破綻しない。TextBlocks(Span / Para / SecTitle / PageTitle)は `size="fluidMd"` 等の variant でも指定できる(`fluidXs` 〜 `fluidXxxl`、4xl / 5xl は className)
- 向き: Tailwind 組み込みの `portrait:` / `landscape:`(カスタムバリアント不要)。`landscape:grid-cols-2 portrait:grid-cols-1` のように書く。JS 側で同じ判定が要るなら `@/lib/viewport` の `useViewportOrientation()`(matchMedia 由来なので CSS と一致する)
- 高さ不足: `short:`(max-height 500px、theme.css)で余白・文字を圧縮
- 余白: 共通スケールは無い。任意値で `p-[clamp(1rem,3vmin,2rem)]` / `gap-[clamp(0.5rem,2vmin,1.5rem)]` と書く
- 固定サイズが必要な要素(QR コード等): `size-[clamp(120px,25vmin,240px)]` のように clamp で範囲を持たせる

```tsx
<Flex className="min-h-0 flex-1 flex-col gap-[clamp(0.5rem,2vmin,1.5rem)] p-[clamp(1rem,3vmin,2rem)]">
  <PageTitle className="text-fluid-4xl short:text-fluid-2xl">テーブル 12</PageTitle>
  <Grid className="min-h-0 flex-1 grid-cols-1 landscape:grid-cols-2">
    <AppImage ... className="size-[clamp(120px,25vmin,240px)]" />
    <Button className="text-fluid-xl">スタッフを呼ぶ</Button>
  </Grid>
</Flex>
```

#### B. ScaledStage(スケール方式)

- 子を「1280×800 のカンプ通りの px 値」で書き、解像度差は倍率だけで吸収する
- 計測コンテナは `flex-1 min-h-0 w-full`。親が flex-col の fill 系土台(KioskFrame / 枠の宣言の fill のページ(利用者・管理))ならそのまま残り領域を占有する。親が確定高さの通常ブロックなら `className="h-full"` を渡す

```tsx
<KioskFrame>
  <ScaledStage logicalWidth={1280} logicalHeight={800} stageClassName="bg-card">
    <Block className="h-[800px] w-[1280px] p-12">
      ...カンプ通りの固定 px レイアウト...
    </Block>
  </ScaledStage>
</KioskFrame>
```

#### useFitScale(DOM 以外・独自描画)

- Konva / Canvas など自前で倍率を適用する場合はフックだけ使う

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const { scale, width, height, isMeasured } = useFitScale(containerRef, {
  logicalWidth: CANVAS_W,
  logicalHeight: CANVAS_H,
  fit: "width",      // ページ内キャンバス: 幅に合わせ、高さは倍率に従う
  minScale: 0.6,     // ドメイン側の判断で下限を付ける
  maxScale: 1.5,
});
return (
  // Layout ラッパー(Block 等)は ref を転送しないため、計測コンテナだけは素の div を使う
  <div ref={containerRef} className="w-full">
    <Stage width={width} height={height} scaleX={scale} scaleY={scale}>...</Stage>
  </div>
);
```

## API

### 共通props

- 全コンポーネント共通: `appearance`, `padding`, `paddingBlock`, `paddingInline`, `margin`, `marginBlock`, `marginInline`(余白の値は下の「余白」)
- `ref`: Block / InBlock / Flex / Stack / Grid / Section / Main は出力要素への `ref` を受け取る（React 19 の ref は props として渡る）。Main の `ref` はどの containerType でも `<main>` 要素を指す

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
- 型: `SpacingValue`・`SpacingName`・`BoxSpacingProps`(`@/lib/spacing`)

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

名前付きの export `FullScreen`(既定の export は無い)。モバイルブラウザのアドレスバーを考慮した真のフルスクリーン表示。`layer` prop でページの層(`@/lib/zLayer` の `PageLayerName`: background … forefront、既定 above-header)を指定。浮く物・toast・cover の層は選べない。

### ScaledStage

`logicalWidth` × `logicalHeight` の論理 px で組んだ子を、コンテナに収まる倍率で transform:scale する（`useFitScale` を内蔵、"use client"）。`fit`: `contain`（既定、レターボックス）/ `width` / `height`、`minScale` / `maxScale`、`align`、`overflow`。サイネージ・キオスク・固定比率の盤面など「カンプ忠実」が優先される画面向け。流体レイアウトとの使い分けと詳細は Usage「KioskFrame と 1 画面に収める画面」と API「ScaledStage の props」。

### KioskFrame の props

| prop | 既定 | 説明 |
|------|------|------|
| `safeArea` | `false` | 端末の切り欠き `var(--app-safe-area-*)` ぶんのパディングを付与 |
| `wakeLock` | `false` | 表示中 Screen Wake Lock で画面スリープを抑止(`useWakeLock`、非対応は no-op) |
| `className` 他 | - | `div` の属性をそのまま受ける。`bg-background text-foreground` が既定 |

### ScaledStage の props

| prop | 既定 | 説明 |
|------|------|------|
| `logicalWidth` / `logicalHeight` | 必須 | 論理キャンバスの px |
| `fit` | `contain` | `contain`(幅高さ両方収める = レターボックス)/ `width`(幅だけ、高さは倍率に従う)/ `height` |
| `minScale` / `maxScale` | `0` / `Infinity` | 倍率の下限・上限。純粋フィットが既定。「スマホ幅で潰れるので 0.6 以下にしない」のような判断は呼び出し側が渡す |
| `align` | `center` | 余白が出た時の配置。`center` は `m-auto` の安全な中央寄せ(はみ出しても先頭が切れない) |
| `overflow` | `clip` | `minScale` で収まらない時。キオスクは `clip`、ページ内キャンバスで横スクロールに逃がすなら `auto` |
| `hideUntilMeasured` | `true` | 初回計測まで非表示にして倍率 1 → 実倍率の跳びを隠す |
| `className` / `stageClassName` | - | 計測コンテナ / 論理ステージのクラス |

### useFitScale の返値

- `{ scale, width, height, containerWidth, containerHeight, isMeasured }`
- 計測前は `scale: 1, isMeasured: false`
- フィットに必要な寸法が 0 の間(`display:none` 等)は `isMeasured: false` のまま

## Extension

- 余白の大きさ: トークン `--space-*` は `src/styles/core/config.css` の `:root` にあり、fork は直下の CSS で値を上書きできる
- Main の部位の印 `data-slot`(fork の CSS が狙う名前): `<main>` = `main`、`plain`・`fullscreen` 以外の外側の 2 段 = `main-container` / `main-layout`。Main は id(呼び手が渡した時だけ `<main>` に付く)・`data-component` を持たない。一覧: [src/app/(user)/_layout/README.md](../../app/(user)/_layout/README.md)「data-slot の一覧」

## Internals

- 段の名前と px の正は `src/lib/spacing/spacingScale.ts`。`@theme` の `--spacing` は使わないので、`--space-*` の上書きは `p-4`・`max-w-2xl` などの数値の class には効かない
- class は生成した表 `src/lib/spacing/spacingClasses.generated.ts`(`pnpm generate styles`)から引く。表の class が全部ビルドの CSS にあるかは `pnpm check styles`(`pnpm build` の末尾)が確かめる
- FullScreen の高さは `var(--viewport-height, 100dvh)` を読む。書き手は root layout の `ViewportHeightWatcher`([src/lib/viewport](../../lib/viewport/README.md))

### KioskFrame の高さと非スクロール

- 高さは `h-[var(--viewport-height,100dvh)]` に固定(`min-h` ではない)。`--viewport-height` は root layout の `ViewportHeightWatcher`(`@/lib/viewport`)が更新する実寸で、モバイルブラウザのアドレスバーを考慮済み
- `overflow-clip`(scroll container にならないので focus 駆動の勝手なスクロールが起きない)+ `overscroll-none`(引っ張り更新・バウンス抑止)
- `flex flex-col` なので、子は `flex-1 min-h-0` で残り高さを得る
- 枠の宣言の fill は「外枠が属性 `data-frame-fill` で確定高さに切り替わり、ページがヘッダー下の残り高さを占有する」フロー内の形、KioskFrame は「自身がビューポート根」。意味が異なるので実装は共有していない

### text-fluid-* と cn

- `text-fluid-*` は `src/lib/cn` で tailwind-merge の font-size グループに登録済み。`cn("text-primary-foreground text-fluid-base")` のように文字色と並べても両方残り、`text-base` 等の固定サイズとは後勝ちで置き換わる
- 未登録の `text-*` は tailwind-merge で文字色扱いになり、同じ要素の文字色を消してしまう。登録先は `src/lib/cn` の `FLUID_TEXT_SIZES`(ドリフトは `pnpm test src/lib/cn/cn.test.mjs` が検出)

### ScaledStage の拡縮

- transform は layout box を変えないため、内部で「拡縮後サイズの枠」を挟んで実占有面積を作っている
- 子の `position: fixed` / ポータルは transform の影響を受ける。Overlays は BodyPortal 経由なのでステージの外に出る
- テキスト入力やスクロール領域をステージ内に置くと、拡縮倍率ぶん操作感が変わる

### useFitScale の計測

- ResizeObserver は useEffect 内のみ(SSR 安全)

## Related

- ページ単位の枠の宣言(fill / hide): [src/app/(user)/_layout/README.md](../../app/(user)/_layout/README.md)
- 管理画面のページ土台: [src/app/admin/_layout/README.md](../../app/admin/_layout/README.md)
