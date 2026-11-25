# Overlays/Loading

## Overview

- ローディング表示コンポーネント群。1 つの単位で、入口は `@/components/Overlays/Loading`(`InlineLoader`・`PageWait`・`ScreenLoader`・`Spinner`)
- 使う時の決まりは札 .claude/rules/items/components/Overlays.mdにある

| コンポーネント | 説明 |
|---------------|------|
| `Spinner` | スピナーアイコン |
| `InlineLoader` | 流れの中に置く読み込み（内容の代わりに Spinner + 省略できる文。覆わない） |
| `PageWait` | 画面の本文の読みを待つ間の表示（本文の所だけ。流れの中・覆う層なし・背景なし・色は枠から継ぐ・文字なし。高さは styles が枠の印から選ぶ） |
| `ScreenLoader` | 画面全体またはローカル領域を覆うローディング（fullscreen は最初の描画でその場に流れの中で画面の高さに出し、mount の後に body 直下で覆う） |

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

`PageWait`(`@/components/Overlays/Loading`):

- `className` / `spinnerClassName` / `spinnerVariant`: 外側のクラス・Spinner の大きさと形(色は親から継ぐ `text-current`)
- 高さ: `src/styles/core/frame.css` の `[data-page-wait]` が選ぶ。枠のある画面 = `--page-wait-min-height`(既定 300px)、枠の無い画面(枠の root `[data-frame-root]` の外・fill・部位を全部隠す)= `--page-wait-frameless-height`(既定 `--viewport-height`)。変数は `src/styles/core/config.css`、fork は自分の CSS の `:root` で上書きする
- 画面の既定の待ちは `src/app/_layout/ScreenWait.tsx`(1 行スイッチ、既定 = `ScreenWait.default.tsx` = `PageWait`)。fork は `ScreenWait.replace.tsx` で丸ごと替える

## Internals

- `ScreenLoader` の fullscreen の外側は `FullscreenLayer`(client): SSR とハイドレーションの間はその場に流れの中で画面の高さ(`--viewport-height`)、mount の後に `<body>` 直下へ portal して fixed + cover の層で覆う。サーバーが出した Suspense の fallback は中身が届くまでハイドレーションされないので、直の読み込みの待ちの間はその場の形のまま(その場で fixed にすると PageTransition の `contain: layout paint` に切られて高さ 0)。`BodyPortal` は mount の前は何も出さない(最初の描画から出したい全画面の待ちには使わない)

- 画面全体のローダー(`GlobalScreenLoader` を root layout に 1 つ置き、`useGlobalLoader()` の `showLoader` / `hideLoader` で出し入れする)は閉じた lib [`@/lib/globalLoader`](../../../lib/globalLoader/README.md) にある。lib は package.json の `peers` で棚を読み、描画は `ScreenLoader`(fullscreen)そのもの。`globalLoaderParity.test.tsx` が同じ DOM になることを確かめる
