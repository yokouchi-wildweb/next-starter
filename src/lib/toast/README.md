# toast

## Overview

- 画面に 1 つずつ出す通知(トースト)と、リダイレクトの先で出すトースト(cookie 渡し)。入口 `@/lib/toast`
- 閉じた lib(`package.json` の入口 `.` だけを読む。形: `src/lib/README.md`)

## Usage

- `GlobalToast` を root に置く(上流は置き済み)。出すのは `useToast` / `useLoadingToast`
- リダイレクトの先で出す: proxy / route で `setRedirectToastCookie` を NextResponse に積み、client の `RedirectToastProvider` が出す
- `show` の options に書いた値が設定より優先する

## API

- フック: `useToast`・`useLoadingToast`・`useToastStore`(ストアを直に読む場合だけ)
- 部品: `GlobalToast`・`ToastItem`
- リダイレクト: `RedirectToastProvider`(client)・`setRedirectToastCookie`
- 型: `ToastMode`・`ToastVariant`・`ToastIconPreset`・`ToastPosition`・`ToastSize`・`Toast`・`ToastOptions`・`RedirectToastPayload`・`RedirectToastVariant`・`ToastConfig`・`ToastOverride`

## Extension

設定の上書き `src/config/lib/toast.config.ts`(`@lib-config/toast`):

```ts
import type { ToastOverride } from "@/lib/toast";

export default { duration: 5000, position: "top-center" } satisfies ToastOverride;
```

- `duration` 表示時間 ms(既定 3000)| `position` 既定の位置(既定 `bottom-center`)| `size` 既定の大きさ(既定 `md`)| `ariaLabel` 領域の読み上げの名前(既定「通知」)
- 退場のアニメーション 350ms・スワイプの閾値 50px は CSS のクラス・操作の調整と組なので `constants.ts` の定数(設定ではない)

## Internals

### 重なりと外押し

- トーストの層はいつも `toast`(浮く物の `floating` より上、`cover` より下。層を選ぶ指定は無い)
- 外側の要素(`data-slot="toast-region"`)に `toast-layer`。浮く物の土台(Primitives の Dialog・Popover、Sheet)は外押しの判定で `isAboveFloatingTarget(target)`(`@/lib/zLayer`、toast・cover の層の中か)を呼び、トーストの中の押しでは閉じない(モーダルを開いたままトーストを押して消せる)

### 依存

- 依存は package.json の通り。appEnv はリダイレクトの cookie の secure、frameDims は下のナビの上に出す枠の寸法、zLayer は層と外押しの判定に使う
- package.json に `sideEffects` を書かないのは、読み込み時に zustand の store を作るため

## Verification

- `pnpm test src/lib/toast`(上書きが表示の値に効くこと)
