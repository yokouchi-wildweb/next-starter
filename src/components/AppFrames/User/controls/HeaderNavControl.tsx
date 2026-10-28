import { frameHideTokens, type FrameHideProps } from "./frameParts";

export type HideHeaderNavProps = FrameHideProps;

/**
 * ページ単位でヘッダーのナビ(PC のメニュー、SP のメニュー開閉ボタンとメニュー)を隠す印。
 * ヘッダー自体は残る。描いた部品が画面にある間だけ効く(仕組みは ./frameParts.ts)
 *
 * @example
 * // 両方隠す（props 無し）
 * <HideHeaderNav />
 *
 * @example
 * // スマホだけ隠す
 * <HideHeaderNav sp />
 *
 * @example
 * // PC だけ隠す
 * <HideHeaderNav pc />
 */
export const HideHeaderNav = (props: HideHeaderNavProps) => {
  const tokens = frameHideTokens("header-nav", props);
  return tokens ? <span hidden data-frame-hide={tokens} /> : null;
};
