# frameDims

## Overview

body 直下へ portal する部品が、枠の寸法変数(ヘッダー・バナー・下のナビの高さ)を外枠と同じ値で使うための `useFrameDimsStyle()`(`@/lib/frameDims`)。読む lib は `defineConfig` だけ(設定の合成)。

## Usage

```tsx
import { useFrameDimsStyle } from "@/lib/frameDims";

const frameDims = useFrameDimsStyle();
return createPortal(
  <div style={frameDims} className="fixed inset-x-0 bottom-[var(--app-bottom-nav-height,0px)]">…</div>,
  document.body,
);
```

- style を付けた要素の中では、外枠の中と同じく `var()` で寸法変数を読める
- 測るのは、枠が外枠の要素に `ref={useFrameRootRef()}` を付けて登録した物だけ(上流の UserLayout・AdminLayout は付け済み)。fork が自前の枠を作るときは同じ 1 行を付ける

```tsx
import { useFrameRootRef } from "@/lib/frameDims";

<Flex data-frame-root="" ref={useFrameRootRef()}>…</Flex>
```

## API

- `useFrameDimsStyle()` と型 `FrameDimsStyle`・`FrameDimPart`・`FrameDimsOverride`
- `useFrameRootRef()` — 枠が外枠の要素に付ける ref(mount で登録、unmount で外す。React 19 の ref の片付け)
- 値 = 登録した外枠のうち、今つながっている中で最後に登録した物の計算値。部位を隠している間(ページの印・出さないデバイス)は 0 になった値。文書の最初の `[data-frame-root]` は探さない(隠れた枠・登録しない fork の自前の枠を拾わない、D92)
- 登録が無い時(枠の外のページ)は空 = `:root` の既定(0px)
- safe-area(`--app-safe-area-*`)は `:root` にあるので写さない。`--app-bottom-nav-height` は safe-area を含む
- SSR / hydration 中は空(hydration 不一致を起こさない)

## Extension

変数そのものを定義するのは `src/styles/core/frame.css`。この lib は名前を読むだけで、既定はそこの名前と同じ。

- `vars` = 部位の名前 → 変数の名前(既定 `header: "--app-header-height"`・`"app-banner": "--app-banner-height"`・`"bottom-nav": "--app-bottom-nav-height"`)。部位の名前は枠の部位一覧(`src/app/_layout/frame/parts.mjs` の data-slot)と同じ

上書きは `src/config/lib/frameDims.config.ts`(合成の決まり: [../defineConfig/README.md](../defineConfig/README.md))。

```ts
import type { FrameDimsOverride } from "@/lib/frameDims";

export default { vars: { header: "--my-header-height" } } satisfies FrameDimsOverride;
```

## Internals

- 隠す・出すの切り替え、画面幅の変化、枠の出入り(登録・外し)に表示中も追随する(登録した外枠の MutationObserver + resize + 登録の購読、1 フレームに 1 回読み直す。外枠が替われば observer を付け直す)
- 登録は lib の中の module の並び(`frameRoot.ts`)。body 直下の部品は枠の React の木の外にも置かれる(GlobalToast は root layout)ので context ではなく登録にした

## Verification

`pnpm test src/lib/frameDims`(外枠の値の写し方・設定の既定・上書きした名前・登録の順と外し・observe の指定と付け直し)
