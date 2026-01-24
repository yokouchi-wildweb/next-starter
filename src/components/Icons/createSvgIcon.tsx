/**
 * SVGの子要素からLucideIcon完全互換のアイコンコンポーネントを生成
 *
 * Lucideと同じprops（color, size, strokeWidth, absoluteStrokeWidth等）を全てサポート
 *
 * @example
 * export const StarIcon = createSvgIcon(
 *   () => <path d="M12 2L15 8.5L22 9.5L17 14.5L18 22L12 18.5L6 22L7 14.5L2 9.5L9 8.5Z" />,
 *   "StarIcon"
 * );
 *
 * // 使用時はLucideIconと全く同じ
 * <StarIcon size={32} color="red" strokeWidth={1.5} />
 */

import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";
import type { CustomIcon } from "./types";

/** Lucideと同じデフォルト属性 */
const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * SVGの子要素を返す関数からLucideIcon互換コンポーネントを生成
 *
 * @param renderChildren - SVGの子要素（path, circle等）を返す関数
 * @param displayName - コンポーネントの表示名
 */
export const createSvgIcon = (
  renderChildren: () => React.ReactNode,
  displayName: string
): CustomIcon => {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(
    (
      {
        color = "currentColor",
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className,
        children,
        ...rest
      },
      ref
    ) => (
      <svg
        ref={ref}
        {...defaultAttributes}
        width={size}
        height={size}
        stroke={color}
        strokeWidth={
          absoluteStrokeWidth
            ? (Number(strokeWidth) * 24) / Number(size)
            : strokeWidth
        }
        className={className}
        aria-hidden="true"
        {...rest}
      >
        {renderChildren()}
        {children}
      </svg>
    )
  );
  Icon.displayName = displayName;
  return Icon;
};
