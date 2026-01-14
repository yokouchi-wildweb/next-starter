/**
 * SVGコンポーネントからLucideIcon互換のアイコンコンポーネントを生成
 *
 * @example
 * const SvgContent = (props: React.SVGProps<SVGSVGElement>) => (
 *   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
 *     <path d="M12 2L2 7l10 5 10-5-10-5z" />
 *   </svg>
 * );
 * export const MyIcon = createSvgIcon(SvgContent, "MyIcon");
 */

import type { CustomIcon, CustomIconProps } from "./types";

export const createSvgIcon = (
  SvgContent: React.FC<React.SVGProps<SVGSVGElement>>,
  displayName: string
): CustomIcon => {
  const Icon: CustomIcon = ({ size = 24, className, ...props }: CustomIconProps) => (
    <SvgContent width={size} height={size} className={className} {...props} />
  );
  Icon.displayName = displayName;
  return Icon;
};
