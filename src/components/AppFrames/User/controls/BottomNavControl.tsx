import { frameHideTokens, type FrameHideProps } from "./frameParts";

export type HideBottomNavProps = FrameHideProps;

/**
 * ページ単位でボトムナビ(高さ分のスペーサーを含む)を隠す印。描いた部品が画面にある間だけ効く(仕組みは ./frameParts.ts)。
 * 隠す方向だけ: `pc={false}` は「PC では隠さない」= 何もしない(PC に出す指定ではない)
 *
 * @example
 * // 両方隠す（props 無し）
 * <HideBottomNav />
 *
 * @example
 * // スマホだけ隠す（既定はスマホだけ表示なので、これで完全に隠れる）
 * <HideBottomNav sp />
 */
export const HideBottomNav = (props: HideBottomNavProps) => {
  const tokens = frameHideTokens("bottom-nav", props);
  return tokens ? <span hidden data-frame-hide={tokens} /> : null;
};
