# toast

画面に 1 つずつ出す通知(トースト)と、リダイレクトの先で出すトースト(cookie 渡し)。閉じた lib(`package.json` の入口 `.` だけを読む。形: [../README.md](../README.md))。

## 入口(`@/lib/toast`)

- フック: `useToast`・`useLoadingToast`・`useToastStore`(ストアを直に読む場合だけ)
- 部品: `GlobalToast`(root に 1 つ置く)・`ToastItem`
- リダイレクト: `RedirectToastProvider`(client)・`setRedirectToastCookie`(proxy / route で NextResponse に積む)
- 型: `ToastMode`・`ToastVariant`・`ToastIconPreset`・`ToastPosition`・`ToastSize`・`ToastLayer`・`Toast`・`ToastOptions`・`RedirectToastPayload`・`RedirectToastVariant`・`ToastConfig`・`ToastOverride`

## 設定(`src/config/lib/toast.config.ts` = `@lib-config/toast`)

```ts
import type { ToastOverride } from "@/lib/toast";

export default { duration: 5000, position: "top-center" } satisfies ToastOverride;
```

- `duration` 表示時間 ms(既定 3000)| `position` 既定の位置(既定 `bottom-center`)| `size` 既定の大きさ(既定 `md`)| `ariaLabel` 領域の読み上げの名前(既定「通知」)
- `show` の options に書いた値が設定より優先する
- 退場のアニメーション 350ms・スワイプの閾値 50px は CSS のクラス・操作の調整と組なので `constants.ts` の定数

## 依存

`libs`: appEnv(リダイレクトの cookie の secure)・cn・defineConfig・frameDims(下のナビの上に出す枠の寸法)・isClient | 外部: react・react-dom・next・zustand・@use-gesture/react・lucide-react | sideEffects は書かない(読み込み時に zustand の store を作る)

## テスト

`pnpm test src/lib/toast`(上書きが表示の値に効くこと)
