// scripts/structure/lib-package/configSlots.mjs
//
// lib の設定の口(上書きの置き場と、lib が上書きを読む指定子)。ファイルを読まない。
// 単体用 tsconfig の paths・閉じたかの検査(standalone.mjs・closed.mjs)と lint entry/only-entries(eslint-rules/entry.mjs)が同じ物を読む。
// 置き場の名前は地区の地図(src/lib/districtMap)の決まり 1 つ: 値 = config.ts ↔ src/config/lib/<名前>.config.ts、
// 描画専用 = config.ui.ts ↔ src/config/lib/<名前>.ui.config.ts。指定子 = @lib-config/<上書きのファイル名から .config.ts を落とした物>
// (ルートの tsconfig.json の "@lib-config/*": ["./src/config/lib/*.config.ts"] の 1 行が解く)

import path from "node:path";

import { CONFIG_FILE, UI_CONFIG_FILE, overridePathOf, uiOverridePathOf } from "../../../src/lib/districtMap/index.mjs";

/** lib の設定の上書きを読む指定子の頭(@lib-config/<上書きの名前> → src/config/lib/<上書きの名前>.config.ts。ルートの tsconfig.json の 1 行) */
export const LIB_CONFIG_PREFIX = "@lib-config/";

const specifierOf = (override) => `${LIB_CONFIG_PREFIX}${path.posix.basename(override, ".config.ts")}`;

/**
 * lib の設定の口(置き場の名前は地区の地図 src/lib/districtMap の決まり: 値 = config.ts ↔ <名前>.config.ts、描画専用 = config.ui.ts ↔ <名前>.ui.config.ts)
 * - owners = 持ち主のファイル(lib の中。値の設定は config.tsx も可)、override = 上書き(repo 相対)、specifier = lib が上書きを読む指定子
 * @param {string} lib
 * @returns {{ kind: "value" | "ui", owners: string[], override: string, specifier: string }[]}
 */
export function libConfigSlots(lib) {
  const uiOverride = uiOverridePathOf("lib", lib);
  return [
    { kind: "value", owners: [CONFIG_FILE, CONFIG_FILE.replace(/\.ts$/, ".tsx")], override: overridePathOf("lib", lib), specifier: specifierOf(overridePathOf("lib", lib)) },
    { kind: "ui", owners: [UI_CONFIG_FILE], override: uiOverride, specifier: specifierOf(uiOverride) },
  ];
}
