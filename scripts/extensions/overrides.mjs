// scripts/extensions/overrides.mjs
// override の検査: 既定を変える隣のファイル(src/**/<対象>.override.ts(x)・src/app/api/cron/<name>/override.ts)は
// 足した Tier の物で、上流(Tier1)は 1 本も出荷しない(空のものも)。既定は既定の場所に書く。
// fork では空(空白とコメントだけ)は不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)。書式: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SEARCH_ROOT } from "./declarations.mjs";

const OVERRIDE_FILE = /^(?:[A-Za-z][A-Za-z0-9]*\.override|override)\.(ts|tsx)$/;
const CRON_DIR = "src/app/api/cron";

/** 空白とコメントだけのソースか(cron・serviceRegistry の生成器と同じ判定) */
export const isBlankSource = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim() === "";

/** override のファイルか(<対象>.override.ts(x) はどこでも、素の override.ts は cron のタスクのフォルダだけ) */
const isOverridePath = (path) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (!OVERRIDE_FILE.test(name)) return false;
  return !name.startsWith("override.") || new RegExp(`^${CRON_DIR}/[^/]+/override\\.ts$`).test(path);
};

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
