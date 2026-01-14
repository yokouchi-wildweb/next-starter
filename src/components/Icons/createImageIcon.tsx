/**
 * 画像ファイル（PNG/JPG等）からLucideIcon互換のアイコンコンポーネントを生成
 *
 * @example
 * import { iconPath } from "@/utils/assets";
 * export const BrandIcon = createImageIcon(iconPath("brand.png"), "BrandIcon");
 */

import type { CustomIcon, CustomIconProps } from "./types";

export const createImageIcon = (src: string, displayName: string): CustomIcon => {
  const Icon: CustomIcon = ({ size = 24, className }: CustomIconProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={className} />
  );
  Icon.displayName = displayName;
  return Icon;
};
