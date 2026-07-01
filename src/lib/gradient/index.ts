// src/lib/gradient/index.ts
// グラデーショントークン / カラー値モデルの公開API（純粋TS・re-export のみ）。

export type {
  GradientStop,
  GradientToken,
  GradientTokenInput,
  ColorValue,
  ColorMode,
  ResolveColorContext,
} from "./types";

export { DEFAULT_GRADIENT_ANGLE, buildGradientCss, toGradientToken } from "./build";
export {
  registerGradients,
  listGradients,
  listGradientInputs,
  getGradient,
} from "./registry";
export { isGradient, extractEdgeColors } from "./css";
export {
  isColorValue,
  resolveColorValue,
  normalizeColorValue,
} from "./colorValue";
