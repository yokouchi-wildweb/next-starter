/**
 * 画像ファイル（PNG/JPG/SVG等）からLucideIcon互換のアイコンコンポーネントを生成
 *
 * 制限事項:
 * - color, strokeWidth, absoluteStrokeWidth等のSVG属性は効果なし
 * - imgタグを使用するため、SVGの動的スタイリングは不可
 * - SVGファイルでLucide互換のスタイリングが必要な場合はcreateSvgIconを使用
 *
 * @example
 * import { iconPath } from "@/utils/assets";
 * export const BrandIcon = createImageIcon(iconPath("brand.png"), "BrandIcon");
 */

import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";
import type { CustomIcon } from "./types";

/**
 * 画像ファイルからLucideIcon互換コンポーネントを生成
 *
 * @param src - 画像のパス
 * @param displayName - コンポーネントの表示名
 */
export const createImageIcon = (src: string, displayName: string): CustomIcon => {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(
    ({ size = 24, className }, _ref) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={className}
        aria-hidden="true"
      />
    )
  );
  Icon.displayName = displayName;
  return Icon;
};
