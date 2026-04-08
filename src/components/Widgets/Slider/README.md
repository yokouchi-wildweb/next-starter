# Slider

Embla Carousel ベースの汎用スライダーコンポーネント。

## 基本的な使い方

```tsx
<Slider
  items={images}
  renderItem={(item) => <img src={item.url} alt={item.alt} />}
/>
```

## Props

### 必須

| prop | 型 | 説明 |
|------|------|------|
| `items` | `T[]` | スライドに表示するデータ配列。空配列の場合は何も描画しない |
| `renderItem` | `(item: T, index: number) => ReactNode` | 各スライドの描画関数 |

### レイアウト・表示

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `peek` | `"left" \| "right" \| "both" \| false` | — | 隣接スライドのチラ見せ。1アイテム以下では自動で無効化される（`keepPeekOnSingle` で上書き可） |
| `keepPeekOnSingle` | `boolean` | `false` | `true` にすると1アイテム時もpeekを維持する。複数スライダーを並べた際に見た目を統一したい場合に使う |
| `slideSize` | `string \| ResponsiveSlideSize` | `"85%"` | peek時のスライドサイズ。文字列で固定値、オブジェクトでブレークポイント別に指定 |
| `gap` | `"sm" \| "md" \| "lg"` | `"md"` | スライド間の余白 |
| `containerWidth` | `number \| string` | — | スライダー全体の幅を固定する場合に指定 |
| `align` | `"start" \| "center" \| "end" \| number` | — | Emblaのalignを直接指定。peekのデフォルトalignを上書きする。数値(0〜1)は比率指定 |
| `loop` | `boolean` | `false` | 無限ループ |
| `containScroll` | `"trimSnaps" \| "keepSnaps" \| false` | Emblaデフォルト(`"trimSnaps"`) | `false` で端スライドの中央寄せを強制できる |
| `mask` | `boolean \| { left?: number; right?: number }` | `true` | 端のフェードマスク。`true` = 左右10%、`false` = なし、オブジェクトで個別指定(%) |

### 矢印ナビゲーション

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `showArrows` | `ResponsiveToggle` | `true` | 矢印の表示制御。`true`/`false` または `"sm"`, `"md"` 等でブレークポイント以上で表示 |
| `arrowVariant` | `"light" \| "dark" \| "outline" \| "ghost"` | `"light"` | 矢印のスタイル |
| `arrowSize` | `"sm" \| "md" \| "lg"` | `"md"` | 矢印のサイズ |
| `arrowPosition` | `"inside" \| "outside"` | `"inside"` | 矢印の配置位置 |
| `renderArrow` | `(props: RenderArrowProps) => ReactNode` | — | 矢印を完全カスタム描画。指定時は variant/size/position を無視 |

### ドットナビゲーション

| prop | 型 | デフォルト | 説明 |
|------|------|------|------|
| `showDots` | `ResponsiveToggle` | `true` | ドットの表示制御 |
| `dotVariant` | `"default" \| "line" \| "dash"` | `"default"` | ドットのスタイル。`default` = 丸、`line` = アクティブ時に伸びるバー、`dash` = 短い横棒 |
| `dotPosition` | `"bottom" \| "inside-bottom"` | `"bottom"` | ドットの配置。`inside-bottom` はスライダー内に重ねて表示 |
| `renderDots` | `(props: RenderDotsProps) => ReactNode` | — | ドットを完全カスタム描画 |

### コールバック・プラグイン

| prop | 型 | 説明 |
|------|------|------|
| `onActiveClick` | `(item: T, index: number) => void` | 現在アクティブなスライドをクリックした時のコールバック |
| `onSlideChange` | `(index: number) => void` | スライド変更時のコールバック |
| `autoplay` | `boolean \| { delay?: number; stopOnInteraction?: boolean }` | 自動再生。`true` でデフォルト(4000ms, 操作時停止)。オブジェクトで詳細設定 |
| `plugins` | `EmblaPlugins` | autoplay以外のEmblaプラグインを直接渡す |

## 使用例

### チラ見せ付きカルーセル

```tsx
<Slider
  items={products}
  renderItem={(p) => <ProductCard product={p} />}
  peek="both"
  slideSize="70%"
  loop
/>
```

### 1アイテムでもpeekを維持

```tsx
<Slider
  items={machines}
  renderItem={(m) => <MachineCard machine={m} />}
  peek="both"
  slideSize="85%"
  keepPeekOnSingle
/>
```

### モバイルではドット、PCでは矢印

```tsx
<Slider
  items={banners}
  renderItem={(b) => <BannerImage banner={b} />}
  showArrows="md"
  showDots={true}
/>
```

### レスポンシブなスライドサイズ

```tsx
<Slider
  items={products}
  renderItem={(p) => <ProductCard product={p} />}
  peek="both"
  slideSize={{ default: "85%", lg: "60%", xl: "50%" }}
/>
```

モバイルでは85%、lg(1024px)以上で60%、xl(1280px)以上で50%のスライドサイズになる。
CSS カスタムプロパティとメディアクエリで実現するため、JS のリサイズ監視不要でSSR対応。

### 自動再生 + カスタムドット

```tsx
<Slider
  items={slides}
  renderItem={(s) => <HeroSlide slide={s} />}
  autoplay={{ delay: 5000 }}
  loop
  renderDots={({ count, current, onDotClick }) => (
    <MyCustomDots count={count} current={current} onClick={onDotClick} />
  )}
/>
```

## 動作の補足

- `items` が空配列の場合は `null` を返す（何も描画しない）
- 非アクティブなスライドをクリックするとそのスライドへスクロールする
- `peek` は方向によって自動的にalignが決まる（left→end, right→start, both→center）。`align` で上書き可能
- `mask` はpeek無しでも単独で使用可能
- `slideSize` にオブジェクトを渡すと、CSSカスタムプロパティ + メディアクエリでブレークポイント別にサイズが切り替わる。同一ページに複数Sliderがあっても `useId` でスコープが分離される
