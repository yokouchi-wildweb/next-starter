# CurrencyDisplay

通貨表示コンポーネント。各通貨の色・アイコンを統一フォーマットで表示する。

## 基本的な使い方

```tsx
import { CurrencyDisplay } from "@/features/core/wallet/components/CurrencyDisplay";

<CurrencyDisplay walletType="coin" amount={1000} />
```

## Props

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `walletType` | WalletType | **必須** | ウォレット種別 |
| `amount` | number | **必須** | 表示金額 |
| `size` | "xs" \| "sm" \| "md" \| "lg" \| "xl" | "md" | テキストサイズ |
| `iconSize` | "xs" \| "sm" \| "md" \| "lg" \| "xl" | size と同じ | アイコンサイズ |
| `gap` | "none" \| "xs" \| "sm" \| "md" \| "lg" \| "xl" | "md" | アイコンと数値の間隔 |
| `align` | "center" \| "baseline" \| "start" \| "end" | "center" | 垂直方向の揃え |
| `showIcon` | boolean | true | アイコンを表示するか |
| `showLabel` | boolean | false | ラベルを表示するか（例: "1,000 コイン"） |
| `showUnit` | boolean | false | 単位を表示するか（例: "1,000 pt"） |
| `bold` | boolean | false | 太字にするか |
| `animate` | boolean | false | カウントアップアニメーションを有効にするか |
| `animationDuration` | number | 2 | アニメーション時間（秒） |
| `preserveValue` | boolean | true | 値変更時に前の値から開始するか |

## アニメーション機能

`animate` を有効にすると、数値が滑らかにカウントアップするアニメーションが適用される。

```tsx
// アニメーションあり
<CurrencyDisplay walletType="coin" amount={1000} animate />

// アニメーション時間を短く
<CurrencyDisplay walletType="coin" amount={1000} animate animationDuration={1} />
```

### preserveValue について

値が変更された時の開始値を制御する。

- **true（デフォルト）**: 前の値から新しい値へアニメーション（例: 100 → 500）
- **false**: 常に0から新しい値へアニメーション（例: 0 → 500）

```tsx
// 残高の増減を見せたい場合（推奨）
<CurrencyDisplay walletType="coin" amount={balance} animate preserveValue />

// 毎回0からカウントしたい場合
<CurrencyDisplay walletType="coin" amount={score} animate preserveValue={false} />
```

## 使用例

```tsx
// シンプルな表示
<CurrencyDisplay walletType="coin" amount={1000} />

// ラベル付き
<CurrencyDisplay walletType="coin" amount={1000} showLabel />
// → "1,000 コイン"

// 単位付き
<CurrencyDisplay walletType="point" amount={500} showUnit />
// → "500 pt"

// 大きめ・太字・アニメーション付き
<CurrencyDisplay
  walletType="coin"
  amount={10000}
  size="xl"
  bold
  animate
  animationDuration={1.5}
/>

// アイコンなし
<CurrencyDisplay walletType="coin" amount={1000} showIcon={false} />
```
