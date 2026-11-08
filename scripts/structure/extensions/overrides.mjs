// scripts/structure/extensions/overrides.mjs
// override の検査: 既定を変える隣のファイル(src/**/<対象>.override.ts(x)。cron は task.ts の隣の task.override.ts)は
// 足した Tier の物で、上流(Tier1)は 1 本も出荷しない(空のものも)。既定は既定の場所に書く。
// fork では空(空白とコメントだけ)は不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)。
// <対象>.override の隣に対象(<対象>.<拡張子> か <対象>/)が無ければ孤立で失敗(全 Tier)。受け口の中は項目と照らす extensions.mjs の側。書式: ./README.md

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { SEARCH_ROOT } from "../../../src/lib/districtMap/declarations.mjs";

// <対象> は user.role・user.profile のように . も含む
const OVERRIDE_FILE = /^[A-Za-z_][\w.-]*\.override\.(ts|tsx)$/;
const FRAME_OVERRIDE = /^src\/app\/(?:.*\/)?frame\.override\.tsx?$/;

/** 空白とコメントだけのソースか(cron・serviceRegistry の生成器と同じ判定) */
export const isBlankSource = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim() === "";

/** override のファイルか(<対象>.override.ts(x)。素の override.ts は override ではない: cron の旧名は src/lib/cron/discover.ts が止める) */
const isOverridePath = (path) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (!OVERRIDE_FILE.test(name)) return false;
  // src/app の frame.override.ts は override ではない(枠の宣言は frame.default.ts / frame.ts。止めるのは frames.mjs)
  if (FRAME_OVERRIDE.test(path)) return false;
  return true;
};

/** <対象>.override の隣に対象があるか(<対象>.<拡張子> のファイルか <対象>/ のフォルダ) */
function hasTarget(repoRoot, path) {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const target = path.slice(dir.length + 1).replace(/\.override\.tsx?$/, "");
  return readdirSync(join(repoRoot, dir)).some((name) => {
    if (name === target) return statSync(join(repoRoot, dir, name)).isDirectory();
    const dot = name.lastIndexOf(".");
    return dot > 0 && name.slice(0, dot) === target;
  });
}

/**
 * override を集めて検査する
 * @param {string} repoRoot
 * @param {{ isTier1: boolean, receptacleDirs?: Iterable<string> }} identity receptacleDirs = 拡張点の受け口のフォルダ(孤立の検査は extensions.mjs の側)
 * @returns {{ overrides: { path: string, blank: boolean }[], problems: string[] }}
 */
export function checkOverrides(repoRoot, { isTier1, receptacleDirs = [] }) {
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
  const receptacles = new Set(receptacleDirs);
  for (const o of overrides) {
    const dir = o.path.slice(0, o.path.lastIndexOf("/"));
    if (o.blank || receptacles.has(dir)) continue;
    if (!hasTarget(repoRoot, o.path)) problems.push(`${o.path}: 隣に上書きの対象 ${o.path.slice(dir.length + 1).replace(/\.override\.tsx?$/, "")} が無い(孤立した override。対象の名前に合わせるか消す)`);
  }
  return { overrides, problems };
}
