# Overlays/Loading

## Overview

- ローディング表示コンポーネント群。1 つの単位で、入口は `@/components/Overlays/Loading`(`InlineLoader`・`ScreenLoader`・`Spinner`)
- 使う時の決まりは札 .claude/rules/items/components/Overlays.mdにある

| コンポーネント | 説明 |
|---------------|------|
| `Spinner` | スピナーアイコン |
| `InlineLoader` | 流れの中に置く読み込み（内容の代わりに Spinner + 省略できる文。覆わない） |
| `ScreenLoader` | 画面全体またはローカル領域を覆うローディング |

- 使い分け: 内容が無いあいだその場所に出す → `InlineLoader` | 見えている内容の上に重ねて操作を止める → `ScreenLoader`(local / fullscreen)| ボタンの実行中 → `Button` の `loading`([Form/README.md](../../Form/README.md)「Button の読み込み中」)

## Usage

```tsx
import { ScreenLoader } from "@/components/Overlays/Loading";

// フルスクリーン
<ScreenLoader mode="fullscreen" message="読み込み中..." />

// ローカル（親要素は position: relative が必要）
<ScreenLoader mode="local" />
```

```tsx
import { InlineLoader } from "@/components/Overlays/Loading";

if (isLoading) return <InlineLoader />;
<InlineLoader size="lg" message="リンクを確認しています..." />
<InlineLoader size="sm" message="読み込み中" />
```

- ページ遷移中の表示は App Router の標準手段で出す: ルートの `loading.tsx`(`src/app/(user)/loading.tsx`・`src/app/admin/(protected)/loading.tsx` が `ScreenLoader` を出す)、リンク単位の表示は `next/link` の `useLinkStatus`、自前の遷移は `useTransition` の pending。App Router には全体の遷移イベントが無い

## API

`InlineLoader`(`@/components/Overlays/Loading`):

- `size`: `sm` = 横 1 行（Spinner size-4・text-xs・py-2）| `md`（既定）= 中央の塊（size-6・text-sm・py-8）| `lg` = 大きな塊（size-8・text-sm・py-12）
- `message`: Spinner の横（sm）/ 下（md・lg）に出す文。無いときは読み上げ用の隠れた文「読み込み中」を置く。外側は `role="status"` `aria-live="polite"`
- `direction` / `className` / `spinnerClassName` / `spinnerVariant`: 段の値を上書きする（余白・文字の大きさと色・Spinner の大きさと形）

## Internals

- 画面全体のローダー(`GlobalScreenLoader` を root layout に 1 つ置き、`useGlobalLoader()` の `showLoader` / `hideLoader` で出し入れする)は閉じた lib [`@/lib/globalLoader`](../../../lib/globalLoader/README.md) にある。lib は package.json の `peers` で棚を読み、描画は `ScreenLoader`(fullscreen)そのもの。`globalLoaderParity.test.tsx` が同じ DOM になることを確かめる
