# FadeSlider

クロスフェード型のスライダー。CSS Grid で全スライドを同一セルに重ね、`opacity` トランジションで切り替える。`ScrollSlider` と共通の状態契約（controlled/uncontrolled + imperative API）を実装する。

## 基本的な使い方

```tsx
<FadeSlider
  items={banners}
  renderItem={(banner) => <BannerImage banner={banner} />}
  autoplay
  loop
/>
```

## Props

### 必須

| prop | 型 | 説明 |
|------|------|------|
| `items` | `T[]` | スライドデータ配列 |
| `renderItem` | `(item: T, index: number, state: { isActive: boolean }) => ReactNode` | 各スライドの描画関数 |

### 状態制御（両スライダー共通の契約）

| prop | 型 | 説明 |
|------|------|------|
| `defaultIndex` | `number` | 初期 index（uncontrolled 時のみ） |
| `index` | `number` | controlled 時の現在 index |
| `onIndexChange` | `(index: number) => void` | index 変更時のコールバック |
| `loop` | `boolean` | 無限ループ |
| `ref` | `Ref<SliderImperativeApi>` | `next/prev/goTo/play/pause/getState` |

### トランジション

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `transition` | `"crossfade" \| "fadeThrough" \| { kind; duration?; easing?; className? }` | `"crossfade"` | `crossfade` は同時にクロスフェード、`fadeThrough` は旧スライドが完全に消えてから新スライドが現れる |
| `duration` | `number` | `400` | トランジション時間 (ms) |
| `easing` | `string` | `"ease-in-out"` | CSS の transition-timing-function |

### 操作

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `autoplay` | `AutoplayOption` | — | 自動再生。`true` でデフォルト(4000ms, 操作時停止) |
| `enableKeyboard` | `boolean` | `true` | root にフォーカス時の ArrowLeft/Right/Home/End |
| `enableSwipe` | `boolean` | `true` | 水平スワイプで前後へ |
| `swipeThreshold` | `number` | `50` | スワイプ判定の閾値 (px) |
| `pauseOnHover` | `boolean` | `true` | ホバー/フォーカス中は autoplay 一時停止 |
| `respectReducedMotion` | `boolean` | `true` | `prefers-reduced-motion` を尊重 |

### レイアウト・カスタム

| prop | 型 | 説明 |
|------|------|------|
| `containerWidth` | `number \| string` | スライダー全体の幅を固定する場合に指定 |
| `className` | `string` | root に付与する className |
| `slideClassName` | `string` | 各スライドラッパに付与する className |

### 矢印・ドット

ScrollSlider と同じ。`showArrows` / `arrowVariant` / `arrowSize` / `arrowPosition` / `renderArrow` / `showDots` / `dotVariant` / `dotPosition` / `renderDots`。

### コールバック

| prop | 型 | 説明 |
|------|------|------|
| `onActiveClick` | `(item: T, index: number) => void` | アクティブスライドをクリックした時のコールバック |

### a11y

| prop | 型 | 説明 |
|------|------|------|
| `ariaLabel` | `string` | カルーセル全体の aria-label |
| `ariaRoleDescription` | `string` | aria-roledescription の上書き |

## 高さの扱い

全スライドを同じ CSS Grid セルに重ねるため、コンテナの高さは **最大スライドの中身の高さに追従**する。各スライドに明示的な `aspect-ratio` や固定高を付与すれば、`ScrollSlider` と同じ自由度で高さ制御が可能。

```tsx
<FadeSlider
  items={slides}
  renderItem={(s) => <div className="aspect-video">...</div>}
/>
```

## 使用例

### 自動再生ヒーローバナー

```tsx
<FadeSlider
  items={heroSlides}
  renderItem={(s) => <HeroBanner slide={s} />}
  autoplay={{ delay: 6000 }}
  loop
  transition="fadeThrough"
/>
```

### 外部制御 + imperative API

```tsx
const ref = useRef<SliderImperativeApi>(null)

<FadeSlider ref={ref} items={items} renderItem={renderItem} />

<button onClick={() => ref.current?.next()}>次へ</button>
```

### ドット外部表示

```tsx
const [index, setIndex] = useState(0)

<FadeSlider
  items={items}
  renderItem={renderItem}
  index={index}
  onIndexChange={setIndex}
  showDots={false}
/>

<CustomDots count={items.length} current={index} onClick={setIndex} />
```
