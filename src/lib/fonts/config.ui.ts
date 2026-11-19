// src/lib/fonts/config.ui.ts
//
// 書体(Web フォントの読み込み)の描画用の設定。上書きは src/config/lib/fonts.ui.config.ts(@lib-config/fonts.ui)。
// 置き方: src/config/README.md「描画専用の値」と「持ち主の宣言 overrideLoaders」。
// 何も渡さなければ Web フォントは読み込まれず、system フォントのスタックで表示される(src/styles/core/typography.css)。
// next/font のローダーはモジュールのトップレベルで、引数はリテラルで呼ぶ(Next のコンパイラの決まり)。
// そのため上書きでだけ、下の overrideLoaders の指定子から読んだローダーの呼び出しを `const <名前> = <ローダー>({ ... })` の形で許す。
// next/font は Next のコンパイラの外(scripts/、node --test 等)では動かないので、このファイルは root layout だけが読む

import override from "@lib-config/fonts.ui";
import { defineFontsConfig } from "./defineConfig";
import type { FontsConfig, FontsConfigInput } from "./types";

/** 上書きでローダーを読み、トップレベルの const で呼んでよい指定子(lint config-overrides/literal-only が読む) */
export const overrideLoaders = ["next/font/google", "next/font/local"] as const;

/** 上書きのファイルの型(`export default { sans } satisfies FontsOverride`) */
export type FontsOverride = FontsConfigInput;

/** 合成済みの書体の設定(root layout が className を <html> に当てる) */
export const fontsConfig: FontsConfig = defineFontsConfig(override);
