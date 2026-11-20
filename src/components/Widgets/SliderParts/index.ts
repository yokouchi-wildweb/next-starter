// src/components/Widgets/SliderParts — スライダー(FadeSlider・ScrollSlider)が共有する部品・hook・型(入口)
export { SliderArrow } from "./SliderArrow";
export { SliderDots } from "./SliderDots";
export { getCarouselRootA11yProps, getLiveRegionA11yProps, getSlideA11yProps } from "./a11y";
export { getResponsiveVisibilityClass, isResponsiveToggleVisible } from "./helpers";
export { useReducedMotion } from "./useReducedMotion";
export { useSliderAutoplay, type AutoplayControls } from "./useSliderAutoplay";
export { useSliderController, type SliderController } from "./useSliderController";
export { useSliderKeyboard } from "./useSliderKeyboard";
export { useSliderSwipe } from "./useSliderSwipe";
export type {
  ArrowPosition,
  ArrowSize,
  ArrowVariant,
  AutoplayOption,
  DotPosition,
  DotVariant,
  MaskOption,
  RenderArrowProps,
  RenderDotsProps,
  RenderItem,
  ResponsiveToggle,
  SliderA11yProps,
  SliderControlProps,
  SliderImperativeApi,
  TransitionTiming,
} from "./types";
