import { frameHideTokens, type FrameHideProps } from "./frameParts";

export type HideHeaderProps = FrameHideProps;

/**
 * ページ単位でヘッダーを隠す印。描いた部品が画面にある間だけ効く(仕組みは ./frameParts.ts)
 *
 * @example
 * // 両方隠す（props 無し）
 * <HideHeader />
 *
 * @example
 * // スマホだけ隠す
 * <HideHeader sp />
 *
 * @example
 * // PC だけ隠す
 * <HideHeader pc />
 */
export const HideHeader = (props: HideHeaderProps) => {
  const tokens = frameHideTokens("header", props);
  return tokens ? <span hidden data-frame-hide={tokens} /> : null;
};
