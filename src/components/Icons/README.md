# Icons

## Overview

- Lucide と同じ API で、プロジェクト固有アイコンを一元管理する仕組み。画像 / SVG を同じ使い方に揃える
- 読む所: ファイルごと(入口の index は無い) | `@/components/Icons/createImageIcon`・`@/components/Icons/createSvgIcon`・`@/components/Icons/definitions`(アイコン)・`@/components/Icons/types`(型 `CustomIcon` / `CustomIconProps` / `IconComponent`)
- アイコンの定義: `src/components/Icons/definitions.ts`
- 画像: `public/assets/icons/` に置き、パスは `iconPath()`(`src/utils/assets.ts`)で作る
- 使う時・足す時の決まりは札 .claude/rules/items/components/Icons.md にある

## Usage

```tsx
import { FileIcon } from "@/components/Icons/definitions";

<FileIcon size={20} className="text-foreground" />
```

- Lucide のアイコンと同じ型なので、`{ key: "brand", icon: BrandIcon }` のようにアイコンの配列に混ぜられる

### 画像アイコンを足す

- 1) `public/assets/icons/` に置く | 2) `definitions.ts` に定義 | 3) `@/components/Icons/definitions` から使う

```tsx
import { iconPath } from "@/utils/assets";
import { createImageIcon } from "@/components/Icons/createImageIcon";

export const BrandIcon = createImageIcon(iconPath("brand.svg"), "BrandIcon");
```

### SVG アイコンを足す

- 1) 子要素を `createSvgIcon` で定義 | 2) `definitions.ts` に足す | 3) `@/components/Icons/definitions` から使う

```tsx
import { createSvgIcon } from "@/components/Icons/createSvgIcon";

export const StarIcon = createSvgIcon(
  () => <path d="M12 2L15 8.5L22 9.5L17 14.5L18 22L12 18.5L6 22L7 14.5L2 9.5L9 8.5Z" />,
  "StarIcon"
);
```

## API

- 型: `CustomIconProps` = `LucideProps`、`CustomIcon` / `IconComponent` = `LucideIcon`
- 画像アイコン(`createImageIcon(src, displayName)`): `size` / `className` だけが効く。`color` / `strokeWidth` は効かない
- SVG アイコン(`createSvgIcon(render, displayName)`): Lucide の props に対応(`size`, `color`, `strokeWidth`, `absoluteStrokeWidth`)
