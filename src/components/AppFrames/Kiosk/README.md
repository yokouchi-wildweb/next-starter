# AppFrames/Kiosk - キオスク（非スクロール端末画面）の土台

UserLayout / AdminLayout の外側に置く独立ルート群で、「どの解像度・比率でも 1 画面に収まり、**絶対にスクロールしない**」画面を作るための部品群と、その書き方の規約です。

想定用途: 卓上タブレット端末（未ログイン・全画面固定）、店舗スタッフ用タブレット、店内サイネージ、チェックイン端末。

| 部品 | 置き場 | 役割 |
|------|--------|------|
| `KioskFrame` | `@/components/AppFrames/Kiosk` | ビューポート固定・overflow-clip のページ枠（本ディレクトリ） |
| `ScaledStage` | `@/components/Layout` | 固定の論理 W×H を transform:scale でコンテナにフィット（レターボックス） |
| `useFitScale` | `@/hooks/useFitScale` | ScaledStage の倍率計算部分。Canvas / Konva など DOM 以外にも使える |
| `text-fluid-*` | `src/styles/theme.css` | clamp(vmin) ベースの流体フォントスケール |
| `portrait:` / `landscape:` / `short:` | Tailwind 組み込み / theme.css | 向き・高さ不足の分岐 |

---

## KioskFrame - ページ枠

```tsx
// src/app/terminal/layout.tsx
import type { ReactNode } from "react";
import { KioskFrame } from "@/components/AppFrames/Kiosk";

export default function TerminalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <KioskFrame wakeLock safeArea>
      {children}
    </KioskFrame>
  );
}
```

| prop | 既定 | 説明 |
|------|------|------|
| `safeArea` | `false` | `env(safe-area-inset-*)` ぶんのパディングを付与 |
| `wakeLock` | `false` | 表示中 Screen Wake Lock で画面スリープを抑止（`useWakeLock`、非対応は no-op） |
| `className` 他 | - | `div` の属性をそのまま受ける。`bg-background text-foreground` が既定 |

### 仕組みと子の契約

- 高さは `h-[var(--viewport-height,100dvh)]` に**固定**（`min-h` ではない）。`--viewport-height` は root layout の `ViewportHeightWatcher` が更新する実寸で、モバイルブラウザのアドレスバーを考慮済み。この変数が高さの単一ソースであり、KioskFrame 自身は計測しない
- `overflow-clip`（scroll container にならないので focus 駆動の勝手なスクロールが起きない）+ `overscroll-none`（引っ張り更新・バウンス抑止）
- `flex flex-col`。**子は `flex-1 min-h-0` だけで残り高さを得る**。`calc(100dvh - Nrem)` やマジックナンバーは書かない
- スクロールさせたい領域は子側で `overflow-y-auto` を付ける（枠はスクロールしない。内部ペインだけが独自スクロール）

```tsx
// ページ側（例）
<Flex className="min-h-0 flex-1 flex-col">
  <Block className="shrink-0">ヘッダー相当</Block>
  <Block className="min-h-0 flex-1 overflow-y-auto">内部スクロール領域</Block>
  <Block className="shrink-0">操作ボタン行</Block>
</Flex>
```

### UserPage fill / FullScreen との使い分け

| 欲しいもの | 使うもの |
|-----------|---------|
| UserLayout 内で、ヘッダー等と共存する非スクロールのページ土台 | `<UserPage fill>` / `<UserPage immersive>`（[AppFrames/User/README.md](../User/README.md)） |
| AdminLayout 内で、サイドバー等と共存する非スクロールのページ土台 | `<AdminPage fill>` |
| **レイアウトを持たない独立ルート群**のビューポート固定ページ枠 | `<KioskFrame>` |
| 画面全体を覆う一時的なオーバーレイ（スプラッシュ・背景演出） | `<Main containerType="fullscreen">`（fixed オーバーレイ、z 層、body スクロールロック） |

UserPage fill は「外枠が `:has([data-user-fill])` で確定高さに切り替わり、ヘッダー下の残り高さを占有する」フロー内の部品、KioskFrame は「自身がビューポート根」。意味が異なるので実装は共有していない。

### 全画面化ボタン（レシピ）

ボタンは画面デザインの一部なので KioskFrame には内蔵していない。`useFullscreen` でページ側に置く。Fullscreen API はユーザー操作イベント内でしか許可されないため、自動で全画面にはできない（端末側のキオスクモード / ホーム画面追加を併用する）。

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

---

## 1 画面に収める 2 つの方式

画面ごとに A / B のどちらかを選ぶ（混在も可）。

| 方式 | 向く画面 | 使うもの |
|------|---------|---------|
| **A. 流体（fluid）** | テキスト主体、縦横比が変わっても再配置で吸収したい、DOM の操作性（フォーム・スクロール領域）を保ちたい | `flex-1 min-h-0` の比率レイアウト + `text-fluid-*` + `portrait:` / `landscape:` / `short:` + `clamp()` 余白 |
| **B. スケール（fit-scale）** | デザインカンプ忠実、固定比率の盤面・サイネージ、座標データを持つキャンバス | `<ScaledStage logicalWidth logicalHeight>`（または `useFitScale`） |

### A. 流体レイアウトの規約

- **文字**: 固定 px（`text-5xl` 等）ではなく `text-fluid-xs` 〜 `text-fluid-5xl`。`clamp(下限, N vmin, 上限)` なので短辺に比例して縮み、縦横どちらでも破綻しない（`src/styles/theme.css`）。TextBlocks（Span / Para / SecTitle / PageTitle）は `size="fluidMd"` 等の variant でも指定できる（`fluidXs` 〜 `fluidXxxl`、4xl / 5xl は className）
  - `text-fluid-*` は `src/lib/cn` で tailwind-merge の font-size グループに登録済み。`cn("text-primary-foreground text-fluid-base")` のように文字色と並べても両方残り、`text-base` 等の固定サイズとは後勝ちで置き換わる。**theme.css に新しい `--text-*` トークンを足す時は `src/lib/cn` の `FLUID_TEXT_SIZES` にも登録する**（未登録の `text-*` は文字色扱いになり、同じ要素の文字色を消してしまう。`pnpm test:cn` がドリフトを検出）
- **向き**: Tailwind 組み込みの `portrait:` / `landscape:`（カスタムバリアント不要）。`landscape:grid-cols-2 portrait:grid-cols-1` のように書く。JS 側で同じ判定が必要なら `useViewportOrientation()`（matchMedia 由来なので CSS と一致する）
- **高さ不足**: `short:`（max-height 500px、theme.css）で余白・文字を圧縮
- **余白**: 共通スケールは固定していない。任意値で `p-[clamp(1rem,3vmin,2rem)]` / `gap-[clamp(0.5rem,2vmin,1.5rem)]` と書く
- **固定サイズが必要な要素**（QR コード等）: `size-[clamp(120px,25vmin,240px)]` のように clamp で範囲を持たせる
- **縦の配分**: 行ごとに `flex-1 min-h-0` / `shrink-0` で比率を決め、`h-[Npx]` を並べて合計がビューポートを超える書き方をしない

```tsx
<Flex className="min-h-0 flex-1 flex-col gap-[clamp(0.5rem,2vmin,1.5rem)] p-[clamp(1rem,3vmin,2rem)]">
  <PageTitle className="text-fluid-4xl short:text-fluid-2xl">テーブル 12</PageTitle>
  <Grid className="min-h-0 flex-1 grid-cols-1 landscape:grid-cols-2">
    <AppImage ... className="size-[clamp(120px,25vmin,240px)]" />
    <Button className="text-fluid-xl">スタッフを呼ぶ</Button>
  </Grid>
</Flex>
```

### B. ScaledStage（スケール方式）

子を「1280×800 のカンプ通りの px 値」で書き、解像度差は倍率だけで吸収する。

```tsx
<KioskFrame>
  <ScaledStage logicalWidth={1280} logicalHeight={800} stageClassName="bg-card">
    <Block className="h-[800px] w-[1280px] p-12">
      ...カンプ通りの固定 px レイアウト...
    </Block>
  </ScaledStage>
</KioskFrame>
```

| prop | 既定 | 説明 |
|------|------|------|
| `logicalWidth` / `logicalHeight` | 必須 | 論理キャンバスの px |
| `fit` | `contain` | `contain`（幅高さ両方収める = レターボックス）/ `width`（幅だけ、高さは倍率に従う）/ `height` |
| `minScale` / `maxScale` | `0` / `Infinity` | 倍率の下限・上限。純粋フィットが既定。「スマホ幅で潰れるので 0.6 以下にしない」のような判断は呼び出し側が渡す |
| `align` | `center` | 余白が出た時の配置。`center` は `m-auto` の安全な中央寄せ（はみ出しても先頭が切れない） |
| `overflow` | `clip` | `minScale` で収まらない時。キオスクは `clip`、ページ内キャンバスで横スクロールに逃がすなら `auto` |
| `hideUntilMeasured` | `true` | 初回計測まで非表示にして倍率 1 → 実倍率の跳びを隠す |
| `className` / `stageClassName` | - | 計測コンテナ / 論理ステージのクラス |

- 計測コンテナは `flex-1 min-h-0 w-full`。親が flex-col の fill 系土台（KioskFrame / UserPage fill / AdminPage fill）ならそのまま残り領域を占有する。親が確定高さの通常ブロックなら `className="h-full"` を渡す
- transform は layout box を変えないため、内部で「拡縮後サイズの枠」を挟んで実占有面積を作っている。子の `position: fixed` / ポータルは transform の影響を受けるので、モーダル等は ScaledStage の外（Overlays は BodyPortal 経由なので問題ない）
- テキスト入力やスクロール領域をステージ内に置くと拡縮倍率ぶん操作感が変わる。操作主体の画面は A 方式を選ぶ

### useFitScale（DOM 以外・独自描画）

Konva / Canvas など自前で倍率を適用する場合はフックだけ使う。

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
  // Layout ラッパー（Block 等）は ref を転送しないため、計測コンテナだけは素の div を使う
  <div ref={containerRef} className="w-full">
    <Stage width={width} height={height} scaleX={scale} scaleY={scale}>...</Stage>
  </div>
);
```

- ResizeObserver は useEffect 内のみ（SSR 安全）。計測前は `scale: 1, isMeasured: false`
- フィットに必要な寸法が 0 の間（`display:none` 等）は `isMeasured: false` のまま
- 返値: `{ scale, width, height, containerWidth, containerHeight, isMeasured }`
