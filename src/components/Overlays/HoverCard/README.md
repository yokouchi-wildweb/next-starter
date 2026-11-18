# Overlays/HoverCard

## Overview

- ホバープレビュー。リンクやユーザー名にホバーで詳細を表示。入口は `@/components/Overlays/HoverCard`
- 高さの上限と内側スクロールは PopoverContent と同じ構造(`../Popover/README.md` Internals「高さ」)

## Usage

```tsx
import { HoverCard } from "@/components/Overlays/HoverCard";

<HoverCard
  trigger={<Link href="/users/1">@username</Link>}
  openDelay={300}
>
  <UserPreviewCard user={user} />
</HoverCard>
```

## API

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | ホバー対象の要素 |
| `children` | `ReactNode` | - | カードのコンテンツ |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | 表示位置 |
| `size` | `"sm" \| "md" \| "lg" \| "xl" \| "auto"` | `"md"` | サイズ |
| `openDelay` | `number` | `300` | 表示までの遅延（ms） |
| `closeDelay` | `number` | `200` | 非表示までの遅延（ms） |
| `showArrow` | `boolean` | `false` | 矢印表示 |
