import { frameHideTokens, type FrameHideProps } from "./frameParts";

export type HideFooterProps = FrameHideProps;

/**
 * ページ単位でフッターを隠す印。描いた部品が画面にある間だけ効く(仕組みは ./frameParts.ts)
 *
 * @example
 * // 両方隠す（props 無し）
 * <HideFooter />
 *
 * @example
 * // スマホだけ隠す
 * <HideFooter sp />
 *
 * @example
 * // PC だけ隠す
 * <HideFooter pc />
 */
export const HideFooter = (props: HideFooterProps) => {
  const tokens = frameHideTokens("footer", props);
  return tokens ? <span hidden data-frame-hide={tokens} /> : null;
};
