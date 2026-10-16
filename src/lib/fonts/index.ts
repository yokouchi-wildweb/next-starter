// src/lib/fonts/index.ts
//
// 書体(Web フォント読み込み)の設定モデル。
// - 設定の正: src/config/ui/fonts.config.ts(下流所有、defineFontsConfig の差分のみ)
// - 適用: src/app/layout.tsx が FONTS_CONFIG.className を <html> に当てる
// - 参照: src/styles/typography.defaults.css のスタックが --font-sans-loaded / --font-mono-loaded を
//   var() のフォールバック付きで参照する(読み込まれていなければ system スタック)
// 詳細: src/styles/README.md

export { defineFontsConfig, FONT_MONO_LOADED_VAR, FONT_SANS_LOADED_VAR } from "./defineConfig";
export type { FontsConfig, FontsConfigInput, LoadedFont } from "./types";
