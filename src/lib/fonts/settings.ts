// src/lib/fonts/settings.ts
//
// 書体の設定の定義(既定 + 検査、合成は @/lib/defineConfig)。上書きは読まない(読むのは ./config.ui.ts だけ):
// next/font は Next のコンパイラの外で動かないので、テストはここを読み、上書きを compose に渡して確かめる。
//
// 既定で Web フォントを読み込まない理由: 上流の既定は「Inter を宣言しているが実際には
// system-ui で表示されている」状態であり、既定で Google Fonts を読み込むと全 fork の見た目が
// merge で変わり、ビルド時の外部通信依存も増えるため。読み込むかどうかは fork の判断に委ねる。

import { defineConfig, type OverrideOf, type StandardSchemaV1 } from "@/lib/defineConfig";

import type { FontsConfig, LoadedFont } from "./types";

/** next/font ローダーの `variable` オプションに指定する固定名(リテラルで書くこと) */
export const FONT_SANS_LOADED_VAR = "--font-sans-loaded";
export const FONT_MONO_LOADED_VAR = "--font-mono-loaded";

/** 合成する値(渡したフォントだけがキーを持つ。既定 = どちらも無し = system フォント) */
type FontsSettings = { sans?: LoadedFont; mono?: LoadedFont };

const SLOTS = [
  ["sans", FONT_SANS_LOADED_VAR],
  ["mono", FONT_MONO_LOADED_VAR],
] as const;

/** 渡したフォントは next/font のローダーを variable 付きで呼んだ結果であること(className だけでは参照の道に乗らない) */
const schema: StandardSchemaV1<FontsSettings> = {
  "~standard": {
    version: 1,
    vendor: "lib/fonts",
    validate(value) {
      const settings = value as FontsSettings;
      const issues = SLOTS.flatMap(([slot, variableName]) => {
        const font = settings[slot];
        if (font === undefined || (typeof font.variable === "string" && font.variable !== "")) return [];
        return [
          {
            message:
              `${slot} には next/font のローダーを variable オプション付きで呼んだ結果を渡してください ` +
              `(例: Inter({ subsets: ["latin"], variable: "${variableName}" }))`,
            path: [slot],
          },
        ];
      });
      return issues.length > 0 ? { issues } : { value: settings };
    },
  },
};

const defaults: FontsSettings = {};

export const fontsConfigDef = defineConfig(defaults, { label: "fonts", schema });

/** 上書きのファイルの型(`export default { sans } satisfies FontsOverride`) */
export type FontsOverride = OverrideOf<typeof fontsConfigDef>;

/** 上書きを合成し、<html> に当てるクラス名(読み込んだフォントの variable クラスの連結)を組む */
export function buildFontsConfig(override?: FontsOverride): FontsConfig {
  const { sans = null, mono = null } = fontsConfigDef.compose(override ?? {});
  const className = [sans?.variable, mono?.variable].filter(Boolean).join(" ");
  return { sans, mono, className };
}
