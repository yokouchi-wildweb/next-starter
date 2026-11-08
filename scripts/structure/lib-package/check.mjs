// scripts/structure/lib-package/check.mjs
//
// pnpm check lib-package(門 build・ship)。package.json を持つ lib ごとに:
//   1. tsconfig.json を package.json の宣言と比べる(無い・食い違う → 直す行を出す。この lib の型検査はしない)
//   2. その tsconfig.json で型検査する(宣言の外の lib・棚を読む → 落ちる)
//   3. sideEffects の宣言と副作用を照らす
// package.json の形の問題(src/lib/libPackage の checkLibPackage)がある lib は飛ばして名前を出す(形は lint と形の検査が見る)。
// exit 0 = 全部通る(package.json を持つ lib 0 も含む)/ 1 = 問題あり

import path from "node:path";
import { fileURLToPath } from "node:url";

import { listDeclaredLibs, readLibPackage } from "../../../src/lib/libPackage/index.mjs";
import { checkSideEffects } from "./sideEffects.mjs";
import { compareTsconfig, typecheckLib } from "./standalone.mjs";

/** @returns {{ checked: string[], skipped: string[], problems: { lib: string, code: string, message: string }[] }} */
export function checkLibs(root) {
  const checked = [];
  const skipped = [];
  const problems = [];
  for (const lib of listDeclaredLibs(root)) {
    if (readLibPackage(root, lib).problems.length > 0) {
      skipped.push(lib);
      continue;
    }
    checked.push(lib);
    const diverged = compareTsconfig(root, lib);
    problems.push(...diverged);
    if (diverged.length === 0) problems.push(...typecheckLib(root, lib));
    problems.push(...checkSideEffects(root, lib));
  }
  return { checked, skipped, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const { checked, skipped, problems } = checkLibs(root);
  for (const lib of skipped) console.log(`lib-package: ${lib}: package.json の形に問題があるので飛ばした(pnpm lint / src/lib/libPackage の形の検査で直す)`);
  for (const p of problems) console.log(`lib-package: ${p.message}`);
  console.log(`lib-package: package.json を持つ lib ${checked.length + skipped.length}(検査 ${checked.length}・飛ばした ${skipped.length})・問題 ${problems.length}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
