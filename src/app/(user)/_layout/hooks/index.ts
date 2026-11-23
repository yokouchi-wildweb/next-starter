/**
 * User AppFrames 共通フック
 *
 * カスタムヘッダー・フッター作成時に使用するフックを提供
 */

export { useHeaderData, useHeaderMenu, useHeaderNavItems, useCloseMenuOnNavigate } from "./useHeaderData";
export type {
  HeaderNavItem,
  DeviceVisibility,
  UseHeaderDataReturn,
  UseHeaderMenuReturn,
} from "./useHeaderData";

export { useFooterData } from "./useFooterData";
export type { UseFooterDataReturn } from "./useFooterData";
