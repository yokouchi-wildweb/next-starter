# frameDims

body 直下へ portal する部品が、枠の寸法変数(ヘッダー・バナー・下のナビの高さ)を外枠と同じ値で使うための `useFrameDimsStyle()`。読む lib は `defineConfig` だけ(設定の合成)。

## 使い方

```tsx
import { useFrameDimsStyle } from "@/lib/frameDims";

const frameDims = useFrameDimsStyle();
return createPortal(
  <div style={frameDims} className="fixed inset-x-0 bottom-[var(--app-bottom-nav-height,0px)]">…</div>,
  document.body,
);
```

- portal した部品の一番外の要素に style を付け、中では外枠の中と同じく `var()` で書く。外枠を自分で読まない
- 値 = 外枠(既定 `[data-frame-root]`)の計算値。部位を隠している間(ページの印・出さないデバイス)は 0 になった値
- 隠す・出すの切り替え、画面幅の変化に表示中も追随する(外枠の MutationObserver + resize、1 フレームに 1 回読み直す)
- 外枠が無い時(枠の外のページ)は空 = `:root` の既定(0px)
- safe-area(`--app-safe-area-*`)は `:root` にあるので写さない。`--app-bottom-nav-height` は safe-area を含む
- SSR / hydration 中は空(hydration 不一致を起こさない)

## 設定

変数そのものを定義するのは `src/styles/core/frame.css`。この lib は名前を読むだけで、既定はそこの名前と同じ。

- `rootSelector` = 外枠の印(既定 `"[data-frame-root]"`)
- `vars` = 部位の名前 → 変数の名前(既定 `header: "--app-header-height"`・`"app-banner": "--app-banner-height"`・`"bottom-nav": "--app-bottom-nav-height"`)。部位の名前は枠の部位一覧(`src/app/_layout/frame/parts.mjs` の data-slot)に合わせる

上書きは `src/config/lib/frameDims.config.ts`(合成の決まり: [../defineConfig/README.md](../defineConfig/README.md))。

```ts
import type { FrameDimsOverride } from "@/lib/frameDims";

export default { vars: { header: "--my-header-height" } } satisfies FrameDimsOverride;
```

## 入口

`useFrameDimsStyle` と型 `FrameDimsStyle`・`FrameDimPart`・`FrameDimsOverride`。

## テスト

`pnpm test src/lib/frameDims`(外枠の値の写し方・設定の既定・上書きした名前・observe の指定)
