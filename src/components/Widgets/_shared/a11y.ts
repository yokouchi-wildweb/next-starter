import type { SliderA11yProps } from "./types"

/**
 * カルーセル root 要素に付与する a11y 属性を生成する。
 * WAI-ARIA の carousel パターンに準拠。
 */
export function getCarouselRootA11yProps({
  ariaLabel,
  ariaRoleDescription = "carousel",
}: SliderA11yProps = {}) {
  return {
    role: "region" as const,
    "aria-roledescription": ariaRoleDescription,
    ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
  }
}

/**
 * 各スライドラッパに付与する a11y 属性を生成する。
 * 非アクティブスライドは aria-hidden + inert でフォーカス・スクリーンリーダーから除外する。
 */
export function getSlideA11yProps({
  index,
  count,
  isActive,
}: {
  index: number
  count: number
  isActive: boolean
}) {
  return {
    role: "group" as const,
    "aria-roledescription": "slide",
    "aria-label": `${index + 1} / ${count}`,
    ...(isActive ? {} : { "aria-hidden": true, inert: "" as unknown as boolean }),
  }
}

/**
 * ライブリージョン用属性。autoplay 時はアナウンス抑制のため off、
 * それ以外は polite でアナウンス。
 */
export function getLiveRegionA11yProps(hasAutoplay: boolean) {
  return {
    "aria-live": hasAutoplay ? ("off" as const) : ("polite" as const),
    "aria-atomic": true,
  }
}
