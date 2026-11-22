// scripts/structure/extensions/intake.mjs
// 受け口の一覧(src/lib/forkOwnership/intake.txt)の生成区画の入力を木から集め、読み手 src/lib/districtMap/intakeRows.mjs(宣言 2 段から行を組む)を呼ぶ
// (pnpm generate extensions が書き、pnpm check extensions がずれを止める)。区画の印と差し替えは src/lib/forkOwnership/intake.mjs。書式: ./README.md

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadPhases, scanTargets } from "../../runner/phases/scan.mjs";
import { parseSwitchLayout, APP_DIR, discoverRoutes, listAppFiles } from "../../../src/lib/screens/node.mjs";

import { intakeRowsOf } from "../../../src/lib/districtMap/index.mjs";
import { INTAKE_FILE, replaceIntakeBlock } from "../../../src/lib/forkOwnership/node.mjs";
import { intakeOutputGlobs } from "../../../src/lib/districtMap/node.mjs";

/** ルートの page.tsx と枠の 1 行スイッチの layout.tsx(src/app が無い fixture は空) */
function readScreens(repoRoot) {
  if (!existsSync(join(repoRoot, APP_DIR))) return { pages: [], frameSwitches: [] };
  const { routes } = discoverRoutes(listAppFiles(repoRoot));
  const pages = [...new Set(routes.map((r) => r.page))];
  const layouts = [...new Set(routes.flatMap((r) => r.layouts))];
  const frameSwitches = layouts.filter((path) => parseSwitchLayout(readFileSync(join(repoRoot, path), "utf8")).target !== null);
  return { pages, frameSwitches };
}

/**
 * phase.json の outputs・regions(段階の一覧の無い fixture は空)。並びは段階の順(after を満たす順)。
 * outputs は generated の行になる物だけ(every-run で、ドメインの置き換えを持たない glob。src/lib/districtMap/domainOutputs.mjs intakeOutputGlobs)
 */
function readGenerators(repoRoot) {
  const scriptsDir = join(repoRoot, "scripts");
  if (!existsSync(join(scriptsDir, "runner/phases/phases.json"))) return [];
  return scanTargets(scriptsDir, loadPhases(scriptsDir))
    .map((t) => ({ name: t.name, outputs: intakeOutputGlobs(t.decl.outputs), regions: t.decl.regions }))
    .filter((g) => g.outputs.length > 0 || g.regions);
}

/**
 * intake.txt の生成区画を作り直したテキスト(intake.txt が無いリポ = テストの fixture では null)
 * @returns {{ path: string, content: string } | { problem: string } | null}
 */
export function planIntake(repoRoot, points, switches) {
  const abs = join(repoRoot, INTAKE_FILE);
  if (!existsSync(abs)) return null;
  const replaced = replaceIntakeBlock(readFileSync(abs, "utf8"), intakeRowsOf({ points, switches, ...readScreens(repoRoot), generators: readGenerators(repoRoot) }));
  return "problem" in replaced ? { problem: `${INTAKE_FILE}: ${replaced.problem}` } : { path: INTAKE_FILE, content: replaced.text };
}
