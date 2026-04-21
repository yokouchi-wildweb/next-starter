# ScrollSlider

Embla Carousel ベースの「横スクロール型」スライダー。`FadeSlider` と共通の状態契約 (controlled/uncontrolled + imperative API) を実装する。

## 基本的な使い方

```tsx
<ScrollSlider
  items={images}
  renderItem={(item) => <img src={item.url} alt={item.alt} />}
/>
```

## Props

### 必須

| prop | 型 | 説明 |
|------|------|------|
| `items` | `T[]` | スライドに表示するデータ配列。空配列の場合は何も描画しない |
| `renderItem` | `(item: T, index: number, state: { isActive: boolean }) => ReactNode` | 各スライドの描画関数 |

### 状態制御（両スライダー共通の契約）

| prop | 型 | 説明 |
|------|------|------|
| `defaultIndex` | `number` | 初期 index（uncontrolled 時のみ） |
| `index` | `number` | controlled 時の現在 index |
| `onIndexChange` | `(index: number) => void` | index 変更時のコールバック |
| `loop` | `boolean` | 無限ループ |
| `ref` | `Ref<SliderImperativeApi>` | `next/prev/goTo/play/pause/getState` を命令的に呼ぶ |

### レイアウト・表示

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `peek` | `"left" \| "right" \| "both" \| false` | — | 隣接スライドのチラ見せ。1アイテム以下では自動で無効化される（`keepPeekOnSingle` で上書き可） |
| `keepPeekOnSingle` | `boolean` | `false` | `true` で1アイテム時も peek を維持する |
| `slideSize` | `string \| ResponsiveSlideSize` | `"85%"` | peek 時のスライドサイズ。文字列で固定値、オブジェクトでブレークポイント別 |
| `gap` | `"sm" \| "md" \| "lg"` | `"md"` | スライド間の余白 |
| `containerWidth` | `number \| string` | — | スライダー全体の幅を固定する場合に指定 |
| `align` | `"start" \| "center" \| "end" \| number` | — | Embla の align を直接指定。数値(0〜1)は比率 |
| `containScroll` | `"trimSnaps" \| "keepSnaps" \| false` | Embla デフォルト (`"trimSnaps"`) | `false` で端スライドの中央寄せを強制 |
| `mask` | `boolean \| { left?: number; right?: number }` | `true` | 端のフェードマスク。peek 無しでも単独使用可 |

### 矢印ナビゲーション

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `showArrows` | `ResponsiveToggle` | `true` | 矢印の表示制御 |
| `arrowVariant` | `"light" \| "dark" \| "outline" \| "ghost"` | `"light"` | 矢印のスタイル |
| `arrowSize` | `"sm" \| "md" \| "lg"` | `"md"` | 矢印のサイズ |
| `arrowPosition` | `"inside" \| "outside"` | `"inside"` | 矢印の配置位置 |
| `renderArrow` | `(props: RenderArrowProps) => ReactNode` | — | 矢印を完全カスタム描画 |

### ドットナビゲーション

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `showDots` | `ResponsiveToggle` | `true` | ドットの表示制御 |
| `dotVariant` | `"default" \| "line" \| "dash"` | `"default"` | ドットのスタイル |
| `dotPosition` | `"bottom" \| "inside-bottom"` | `"bottom"` | ドットの配置 |
| `renderDots` | `(props: RenderDotsProps) => ReactNode` | — | ドットを完全カスタム描画 |

### コールバック・プラグイン

| prop | 型 | 説明 |
|------|------|------|
| `onActiveClick` | `(item: T, index: number) => void` | 現在アクティブなスライドをクリックした時のコールバック |
| `autoplay` | `AutoplayOption` | 自動再生。`true` でデフォルト(4000ms, 操作時停止) |
| `plugins` | `EmblaPlugins` | autoplay 以外の Embla プラグインを直接渡す |

### a11y

| prop | 型 | 説明 |
|------|------|------|
| `ariaLabel` | `string` | カルーセル全体の aria-label |
| `ariaRoleDescription` | `string` | aria-roledescription の上書き（デフォルト `"carousel"`） |

## 命令型 API（`ref`）

```tsx
const sliderRef = useRef<SliderImperativeApi>(null)

<ScrollSlider ref={sliderRef} ... />

sliderRef.current?.next()
sliderRef.current?.goTo(3)
sliderRef.current?.pause()
```

## v1 → v2 移行（旧 `Slider` から）

| 旧 | 新 |
|---|---|
| `import { Slider } from "@/components/Widgets"` | `import { ScrollSlider } from "@/components/Widgets"` |
| `onSlideChange` | `onIndexChange` |

その他の props はそのまま互換。
