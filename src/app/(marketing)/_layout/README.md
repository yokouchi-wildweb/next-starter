# src/app/(marketing)/_layout — LP の枠

## Overview

- `(marketing)/` はランディングページ等の枝で、`(user)/` の枠(ヘッダー・フッター)の外にある。ここはその枝の枠の置き場
- 既定 `MarketingLayout.tsx` = 枠なしの素通し(`<>{children}</>`)。ページが画面の全面を持つ。slot は無い
- `../layout.tsx` = 1 行スイッチ `export { MarketingLayout as default } from "./_layout/MarketingLayout";`(fork 所有・write-once。仕組みは src/lib/screens/README.md「ルートの構造と所有権」の枠を描く layout.tsx の項)
- 既定の素通しは upstream が維持する。upstream がここに枠の部品や slot を足すときは notice で知らせる

## Extension

fork が LP に共通の枠を付けるとき:

1. 隣に `MarketingLayout.replace.tsx` を置き、`MarketingLayout` を named export する(default export はしない。`"use client"` は可)
2. `../layout.tsx` を `export { MarketingLayout as default } from "./_layout/MarketingLayout.replace";` に向ける

## Verification

- `pnpm test scripts/structure/routes/screens.test.mjs`: スイッチの形と指す先
- `pnpm workflow ownership check`
