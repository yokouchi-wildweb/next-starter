export { ScrollSlider } from "./ScrollSlider"
export type { ScrollSliderProps, ScrollSlideState, ResponsiveSlideSize } from "./ScrollSlider"

export { FadeSlider } from "./FadeSlider"
export type { FadeSliderProps, FadeSlideState, FadeTransition } from "./FadeSlider"

// 共有 UI 部品（下流が独自スライダーを組むときに再利用可能）
export { SliderArrow } from "./_shared/SliderArrow"
export { SliderDots } from "./_shared/SliderDots"

// 共有型
export type {
  ArrowVariant,
  ArrowSize,
  ArrowPosition,
  RenderArrowProps,
  DotVariant,
  DotPosition,
  RenderDotsProps,
  ResponsiveToggle,
  AutoplayOption,
  MaskOption,
  TransitionTiming,
  SliderControlProps,
  SliderImperativeApi,
  SliderA11yProps,
  RenderItem,
} from "./_shared/types"
