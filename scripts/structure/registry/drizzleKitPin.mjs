// scripts/structure/registry/drizzleKitPin.mjs
// drizzle-kit の版の固定を確かめる(pnpm check registry の一部。門 build / ship)。値を比べるだけで、何も実行しない。
// パッチ patches/drizzle-kit@<版>.patch は版に紐づく(README.md「drizzle-kit へのパッチ」)。範囲指定だと別の版が入ってパッチが外れ、
// db:push が誤った DROP を出しうる。版は上流が README.md の手順で上げる。fork は版を変えない。

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DRIZZLE_KIT_VERSION = "0.31.8";

/** package.json の中身から、固定の誤りを返す(空 = 合っている) */
export function drizzleKitPinProblems(pkg) {
  const problems = [];
  const fix = `fork は drizzle-kit の版を変えない(上流が scripts/structure/registry/README.md の手順で上げる)`;
  const declared = pkg.devDependencies?.["drizzle-kit"] ?? pkg.dependencies?.["drizzle-kit"];
  if (declared === undefined) problems.push(`package.json に drizzle-kit がありません(devDependencies に "drizzle-kit": "${DRIZZLE_KIT_VERSION}")。${fix}`);
  else if (declared !== DRIZZLE_KIT_VERSION) problems.push(`package.json の drizzle-kit が "${declared}" です。範囲でなく "${DRIZZLE_KIT_VERSION}" ぴったりにする。${fix}`);
  const patched = Object.keys(pkg.pnpm?.patchedDependencies ?? {}).filter((key) => key.startsWith("drizzle-kit@"));
  const want = `drizzle-kit@${DRIZZLE_KIT_VERSION}`;
  if (patched.length === 0) problems.push(`pnpm.patchedDependencies に ${want} がありません(パッチが当たらない)。${fix}`);
  for (const key of patched) if (key !== want) problems.push(`pnpm.patchedDependencies の ${key} が固定の版 ${want} と違います。${fix}`);
  return problems;
}

/** リポの package.json を読んで確かめる */
export function checkDrizzleKitPin(repoRoot) {
  return drizzleKitPinProblems(JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")));
}
