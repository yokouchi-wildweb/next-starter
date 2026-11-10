// scripts/structure/extensions/orphans.mjs
// 孤立の検査(1 つ、D165): src の下の <対象>.override.ts(x) と <名前>.replace.ts(x) を 1 回の走査で集め、どれもそれを受ける宣言・既定があるかを見る。
// - .override: 受け口のフォルダ(overrideOf の点。項目と照らすのは extensions.mjs)/ 上書きの対象の点(宣言の overrides の隣の glob)で隣に対象がある。
//   どれでもなければ「受ける点が無い」、点はあるが対象が無ければ「孤立」。空(空白とコメントだけ)は不在と同じで見ない
// - .replace: route の _layout / _screen は src/lib/screens の findRouteReplaceProblems(_layout はスイッチの向け先か .default の隣、_screen の下は全部不可)、
//   それ以外は隣に 1 行スイッチの既定 <名前>.default.ts(x)。fork 所有の _components/ の中は見ない
// pnpm check extensions(門 build / ship / forge)が回す。書式: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";

import { SEARCH_ROOT } from "../../../src/lib/districtMap/declarations.mjs";
import { DEFAULT_IMPL_DIRS, FORK_OWNED_DIR, describeRouteReplaceProblem, findRouteReplaceProblems } from "../../../src/lib/screens/checks.mjs";
import { REPLACE_FILE, isOverridePath, overrideGlobOf, targetOfOverride } from "../../../src/lib/districtMap/extensionNames.mjs";
import { isBlankSource } from "./overrides.mjs";

/** src の下を 1 回だけ歩いて全ファイル(node_modules・. 始まりは降りない) */
function listSrcFiles(repoRoot) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(path);
      } else out.push(path);
    }
  };
  walk(SEARCH_ROOT);
  return out.sort();
}

/** 上書きの対象の点の上書きのパス → 隣の対象のパス(最後の拡張子は対象の glob の物: task.override.ts → task.ts、user.role.override.ts → user.role.json) */
export const targetOf = (path, point) => targetOfOverride(path, point.spec.overrides);

/**
 * @param {string} repoRoot
 * @param {{ points: { owner: string, name: string, declaredIn: string, spec: object }[], receptacleDirs: Iterable<string> }} context
 * @returns {{ problems: string[], overrides: { path: string, point: object }[] }} overrides = 上書きの対象の点が受けた上書き(空を除く。鍵の検査 ./overrideKeys.mjs が読む)
 */
export function checkOrphans(repoRoot, { points, receptacleDirs }) {
  const files = listSrcFiles(repoRoot);
  const present = new Set(files);
  const receptacles = new Set(receptacleDirs);
  const targetPoints = points.filter((p) => p.spec.overrides !== undefined);
  const problems = [];
  const accepted = [];

  for (const path of files.filter(isOverridePath)) {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (receptacles.has(dir) || isBlankSource(readFileSync(join(repoRoot, path), "utf8"))) continue;
    const point = targetPoints.find((p) => matchesGlob(path, overrideGlobOf(p.spec.overrides)));
    if (!point) {
      const globs = targetPoints.map((p) => overrideGlobOf(p.spec.overrides)).join(" / ");
      problems.push(`${path}: この上書きを受ける点が無い(上書きできるのは受け口の項目と、宣言の overrides の点の対象だけ${globs ? `: ${globs}` : ""}。孤立した override は消すか、上書きの口が要るなら /order <上流>)`);
      continue;
    }
    const target = targetOf(path, point);
    if (!present.has(target)) {
      problems.push(`${path}: 隣に上書きの対象 ${target.slice(dir.length + 1)} が無い(孤立した override。上流が消した・改名した対象なら上書きも消すか名前を合わせる。点 ${point.name}、${point.declaredIn})`);
      continue;
    }
    accepted.push({ path, point });
  }

  const inRoute = (path) => path.startsWith("src/app/") && path.split("/").slice(0, -1).some((seg) => DEFAULT_IMPL_DIRS.includes(seg));
  const inForkDir = (path) => path.split("/").slice(0, -1).includes(FORK_OWNED_DIR);
  for (const problem of findRouteReplaceProblems(files.filter((f) => f.startsWith("src/app/")), (f) => (present.has(f) ? readFileSync(join(repoRoot, f), "utf8") : null))) problems.push(describeRouteReplaceProblem(problem));
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const match = REPLACE_FILE.exec(name);
    if (!match || inRoute(path) || inForkDir(path)) continue;
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (!["ts", "tsx"].some((ext) => present.has(`${dir}/${match[1]}.default.${ext}`))) {
      problems.push(`${path}: 隣に既定 ${match[1]}.default.ts(x) が無い(孤立した .replace。置き換えられるのは 1 行スイッチの既定だけ)`);
    }
  }
  return { problems, overrides: accepted };
}
