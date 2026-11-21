// src/lib/fonts/index.ts
//
// 書体(Web フォント読み込み)の設定。入口は "." の 1 つ。
// - 設定: 上書き src/config/lib/fonts.ui.config.ts(@lib-config/fonts.ui、持ち主 ./config.ui.ts。型は FontsOverride)
// - 適用: src/app/layout.tsx が fontsConfig.className を <html> に当てる(fontsConfig を値で読むのは root layout だけ。
//   上書きの next/font は Next のコンパイラの外で動かない)
// - 参照: src/styles/core/typography.css のスタックが --font-sans-loaded / --font-mono-loaded を
//   var() のフォールバック付きで参照する(読み込まれていなければ system スタック)
// 詳細: src/styles/README.md

export { fontsConfig } from "./config.ui";
export { FONT_MONO_LOADED_VAR, FONT_SANS_LOADED_VAR } from "./settings";
export type { FontsOverride } from "./settings";
export type { FontsConfig, LoadedFont } from "./types";
