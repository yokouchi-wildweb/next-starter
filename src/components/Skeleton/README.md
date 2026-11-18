# Skeleton

## Overview

読み込み中の形を描く部品(`@/components/Skeleton/*`)。Shadcn の `Skeleton` をラップした `BaseSkeleton` を中心に、フォームやモーダルなど画面の単位の Skeleton を持つ。

- `BaseSkeleton`: 1 つの形(大きさは Tailwind のクラスで付ける)
- `FormSkeleton`: フォーム全体の読み込み中
- `DetailModalSkeleton`: 詳細モーダルの代わりの表示
- `ImageUploaderSkeleton`: 画像アップローダーの下見の領域
- 画面の単位の 3 つはどれも中で `BaseSkeleton` を使うので、見た目が揃い、props で調整できる

## Usage

```tsx
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";

<BaseSkeleton className="h-8 w-40" />;
```

## API

### BaseSkeleton

| Prop | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `shimmer` | `boolean` | `true` | シマー（光沢）を有効・無効にします |
| `shimmerSpeed` | `number` | `1.6` | シマーの移動速度（秒） |
| `shimmerWidth` | `number` | `60` | シマー帯の幅（%）。**5〜100** の間に clamp されます |
| `backgroundTone` | `"subtle" \| "default" \| "bold"` | `"default"` | 背景色の濃さを切り替えます |

- Tailwind のクラスや `style` もそのまま渡せる

### 画面の単位の Skeleton

- `FormSkeleton`: `fields`(欄の数)・`includeButtons`(下のボタンの形)・`className`
- `DetailModalSkeleton`: `open` / `onOpenChange`(モーダルの開閉)・`rows` / `cols`・`className`
- `ImageUploaderSkeleton`: `className`

## Related

- 部品の置き換えの一覧(skeleton → `Skeleton/BaseSkeleton`): `.claude/rules/core/components.md` wrappers
