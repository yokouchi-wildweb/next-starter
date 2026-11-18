# Primitives/Skeleton

## Overview

- 読み込み中の置き物。完成品は `src/components/Skeleton`（`BaseSkeleton` …）。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `skeleton` — `Skeleton`
- `image-viewer-skeleton` — 画像ビューア（`Overlays/ImageViewer`）の読み込み中が `slot="image-viewer-skeleton"` で渡す `Skeleton`（`Skeleton/BaseSkeleton` を通る）

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
