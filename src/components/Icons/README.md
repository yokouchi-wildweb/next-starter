Icons README
- overview: Lucideと同じAPIで、プロジェクト固有アイコンを一元管理する仕組み
- why: 画像/SVGを同じ使い方に揃え、UI実装を迷わず進めるため
- entry: `@/components/Icons` | exports: `createImageIcon`, `createSvgIcon`, `definitions`
- define_in: `src/components/Icons/definitions.ts` | export: `@/components/Icons`
- assets: `public/assets/icons/` | path: `iconPath()` (`src/utils/assets.ts`)

- quick usage:
```tsx
import { FileIcon } from "@/components/Icons";

<FileIcon size={20} className="text-foreground" />
```

- add image icon: 1) `public/assets/icons/` に配置 | 2) `definitions.ts` に定義 | 3) `@/components/Icons` から使う
```tsx
import { iconPath } from "@/utils/assets";
import { createImageIcon } from "@/components/Icons";

export const BrandIcon = createImageIcon(iconPath("brand.svg"), "BrandIcon");
```

- add svg icon: 1) 子要素を `createSvgIcon` で定義 | 2) `definitions.ts` に追加 | 3) `@/components/Icons` から使う
```tsx
import { createSvgIcon } from "@/components/Icons";

export const StarIcon = createSvgIcon(
  () => <path d="M12 2L15 8.5L22 9.5L17 14.5L18 22L12 18.5L6 22L7 14.5L2 9.5L9 8.5Z" />,
  "StarIcon"
);
```

- behavior image: `size`/`className` のみ有効 | `color`/`strokeWidth` は無効
- behavior svg: Lucide props 対応 | `size`, `color`, `strokeWidth`, `absoluteStrokeWidth`
- rule: 直パス禁止 → `iconPath()` を使用
