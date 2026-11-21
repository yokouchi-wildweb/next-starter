// src/lib/gradient/index.ts
// グラデーショントークン / カラー値モデルの公開API（純粋TS・re-export のみ）。入口は "." の 1 つ(client でも server でも、
// Next の外の生成 scripts/structure/styles/generate-gradient-css.ts からも読む。React と Next を読まない)。

export type {
  GradientStop,
  GradientToken,
  GradientTokenInput,
  ColorValue,
  ColorMode,
  ResolveColorContext,
} from "./types";

export type { GradientConfig, GradientOverride } from "./config";
export { gradientConfig } from "./config";
export { DEFAULT_GRADIENT_ANGLE, buildGradientCss, toGradientToken } from "./build";
export { BASE_GRADIENTS } from "./tokens.base";
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
