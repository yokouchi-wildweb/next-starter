// scripts/structure/extensions/overrides.mjs
// override の検査: 既定を変える隣のファイル(src/**/<対象>.override.ts(x)。cron は task.ts の隣の task.override.ts)は
// 足した Tier の物で、上流(Tier1)は 1 本も出荷しない(空のものも)。既定は既定の場所に書く。
// fork では空(空白とコメントだけ)は不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)。
// 孤立(受ける点・対象が無い)は ./orphans.mjs(1 つの孤立の検査)。受け口の中は項目と照らす extensions.mjs の側。書式: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SEARCH_ROOT } from "../../../src/lib/districtMap/declarations.mjs";
// override のファイルの名前の決まり(<対象> は user.role のように . も含む。src/app の frame.override.ts は枠の宣言で override ではない)の元
import { isOverridePath } from "../../../src/lib/districtMap/extensionNames.mjs";

export { isOverridePath };

/** 空白とコメントだけのソースか(cron・serviceRegistry の生成器と同じ判定) */
export const isBlankSource = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim() === "";

/**
 * override を集めて検査する
 * @param {string} repoRoot
 * @param {{ isTier1: boolean }} identity
 * @returns {{ overrides: { path: string, blank: boolean }[], problems: string[] }}
 */
export function checkOverrides(repoRoot, { isTier1 }) {
  const overrides = [];
  const walk = (dir) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(path);
      } else if (isOverridePath(path)) {
        overrides.push({ path, blank: isBlankSource(readFileSync(join(repoRoot, path), "utf8")) });
      }
    }
  };
  walk(SEARCH_ROOT);
  overrides.sort((a, b) => (a.path < b.path ? -1 : 1));
  const problems = isTier1
    ? overrides.map((o) => `${o.path}: 上流(Tier1)は override を出荷しない(既定は既定の場所に書く。override は足した Tier の物)`)
    : [];
  return { overrides, problems };
}
