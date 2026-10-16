// src/lib/fonts/defineConfig.ts
//
// 下流の差分を既定値(Web フォント無し)にマージし、<html> に当てるクラス名を組み立てる。
// 設定ファイル(src/config/ui/fonts.config.ts)はこの関数を 1 回呼ぶだけにする。
//
// 既定で Web フォントを読み込まない理由: 上流の既定は「Inter を宣言しているが実際には
// system-ui で表示されている」状態であり、既定で Google Fonts を読み込むと全 fork の見た目が
// merge で変わり、ビルド時の外部通信依存も増えるため。読み込むかどうかは fork の判断に委ねる。

import type { FontsConfig, FontsConfigInput, LoadedFont } from "./types";

/** next/font ローダーの `variable` オプションに指定する固定名(リテラルで書くこと) */
export const FONT_SANS_LOADED_VAR = "--font-sans-loaded";
export const FONT_MONO_LOADED_VAR = "--font-mono-loaded";

function assertLoadedFont(font: LoadedFont | null | undefined, slot: string): LoadedFont | null {
  if (font == null) return null;
  if (typeof font.variable !== "string" || font.variable === "") {
    throw new Error(
      `[fonts] ${slot} には next/font のローダーを variable オプション付きで呼んだ結果を渡してください ` +
        `(例: Inter({ subsets: ["latin"], variable: "${slot === "sans" ? FONT_SANS_LOADED_VAR : FONT_MONO_LOADED_VAR}" }))`,
    );
  }
  return font;
}

export function defineFontsConfig(input: FontsConfigInput = {}): FontsConfig {
  const sans = assertLoadedFont(input.sans, "sans");
  const mono = assertLoadedFont(input.mono, "mono");
  const className = [sans?.variable, mono?.variable].filter(Boolean).join(" ");
  return { sans, mono, className };
}
