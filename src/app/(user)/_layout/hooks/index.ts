/**
 * User AppFrames 共通フック
 *
 * カスタムヘッダー・フッター作成時に使用するフックを提供
 */

export { useHeaderData } from "./useHeaderData";
export type {
  HeaderNavItem,
  DeviceVisibility,
  UseHeaderDataReturn,
} from "./useHeaderData";

export { useFooterData } from "./useFooterData";
export type { UseFooterDataReturn } from "./useFooterData";
