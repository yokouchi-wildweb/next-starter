// scripts/structure/extensions/switches.mjs
// 1 行スイッチの検査: 既定 <名前>.default.ts(x)(上流)の隣の素の名前 <名前>.ts(x) = 呼び手が import する口で、採用者所有の 1 行 re-export。
// 組は持ち主の地区の extensionPoints.ts の差替点(change: replace、読み手 src/lib/districtMap/declarations.mjs replacePointsOf)が宣言し、宣言の無い .default は止める。
// 中身(コメントを除く)は ./<名前>.default か ./<名前>.replace を指す re-export 1 文だけ。Tier1 は .default を指す。
// fork の実装 = <名前>.replace.ts(x)(丸ごと置き換え。旧い <名前>.<fork の名前> は止めて移し方を案内する)。
// .default は作ったリポが出す既定の共通の印(D171)。ほかの仕組みが名乗った形(各仕組みの CLAIMED_DEFAULTS、下の CLAIMERS)はスイッチの既定として扱わない。
// 隣に <名前>.default の無い <名前>.replace(孤立)は ./orphans.mjs(1 つの孤立の検査)。page.tsx・layout.tsx のスイッチ(_screen / _components を指す)は pnpm test scripts/structure/routes/screens.test.mjs の側。書式: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { oldMarkerProblem, SEARCH_ROOT, CLAIMED_DEFAULTS, DEFAULT_FILE, isClaimedDefault, replacePointsOf } from "../../../src/lib/districtMap/index.mjs";
import { stripComments } from "../../../src/lib/screens/node.mjs";


/**
 * .default を使うほかの仕組みが名乗るファイルの形(名前の決まりの元 src/lib/districtMap/extensionNames.mjs の CLAIMED_DEFAULTS)
 * @type {readonly { by: string, under: string, name?: string, pattern?: RegExp }[]}
 */
export const CLAIMERS = CLAIMED_DEFAULTS;
export { isClaimedDefault };
const REEXPORT = /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*["']\.\/([^"'/]+)["']\s*;?$/;

/** src の下の <名前>.default.ts(x)(ほかの仕組みが名乗った形を除く)を集める */
function findDefaults(repoRoot, claims) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(`${dir}/${entry.name}`);
      } else if (DEFAULT_FILE.test(entry.name) && !isClaimedDefault(`${dir}/${entry.name}`, claims)) {
        found.push(`${dir}/${entry.name}`);
      }
    }
  };
  walk(SEARCH_ROOT);
  return { defaults: found.sort() };
}

/**
 * スイッチを全部検査する。スイッチの組は拡張点の宣言の差替点(change: replace、default = <名前>.default.ts(x))から得る(宣言 2 段、D35)。
 * 木の .default は宣言の無い物を止めるためだけに見る(走査で黙ってスイッチに数えない)
 * @param {string} repoRoot
 * @param {{ isTier1: boolean, points: { owner: string, name: string, declaredIn: string, spec: object }[], claims?: readonly object[] }} identity
 *   points = 全拡張点 / claims = ほかの仕組みが名乗った .default の形(省略 = CLAIMERS)
 * @returns {{ switches: { path: string, target: string, point: string, declaredIn: string }[], problems: string[] }}
 */
export function checkSwitches(repoRoot, { isTier1, points, claims = CLAIMERS }) {
  const switches = [];
  const { replaces, problems } = replacePointsOf(points);
  const declared = new Set(replaces.map((r) => r.default));
  for (const defaultPath of findDefaults(repoRoot, claims).defaults) {
    if (!declared.has(defaultPath)) {
      problems.push(`${defaultPath}: 差替点の宣言が無い(持ち主の地区の extensionPoints.ts に { change: "replace", default: "${defaultPath}", type, side }。fork は段 2 の移し替えの道具 .notices/20261122-213044-district-stage2.declarations.mjs で書く)`);
    }
  }
  for (const replace of replaces) {
    const defaultPath = replace.default;
    if (!existsSync(join(repoRoot, defaultPath))) {
      problems.push(`${replace.declaredIn}: 差替点 ${replace.point} の default ${defaultPath} が無い`);
      continue;
    }
    const dir = defaultPath.slice(0, defaultPath.lastIndexOf("/"));
    const name = replace.name;
    const switchFile = ["ts", "tsx"].map((ext) => `${dir}/${name}.${ext}`).find((p) => existsSync(join(repoRoot, p)));
    if (!switchFile) {
      problems.push(`${defaultPath}: 隣にスイッチ ${name}.ts(x) が無い(呼び手が import する素の名前。中身は export … from "./${name}.default" の 1 行)`);
      continue;
    }
    const statements = stripComments(readFileSync(join(repoRoot, switchFile), "utf8"))
      .split(";")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const match = statements.length === 1 ? REEXPORT.exec(statements[0]) : null;
    if (!match) {
      problems.push(`${switchFile}: スイッチは re-export 1 文だけ(export … from "./${name}.default" か "./${name}.replace")。処理は既定か fork の実装に書く`);
      continue;
    }
    const target = match[1].replace(/\.(ts|tsx)$/, "");
    if (target !== `${name}.default`) {
      const suffix = target.startsWith(`${name}.`) ? target.slice(name.length + 1) : null;
      if (suffix !== null && suffix !== "replace" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix)) {
        problems.push(oldMarkerProblem(`${switchFile}: 指す先 ./${target}`, `${name}.replace.ts(x)`));
        continue;
      }
      if (suffix !== "replace") {
        problems.push(`${switchFile}: 指す先 ./${target} は ${name}.default か ${name}.replace だけ`);
        continue;
      }
      if (isTier1) {
        problems.push(`${switchFile}: 上流(Tier1)のスイッチは ${name}.default を指す(丸ごと置き換え .replace は fork が切り替える)`);
        continue;
      }
    }
    if (!["ts", "tsx"].some((ext) => existsSync(join(repoRoot, `${dir}/${target}.${ext}`)))) {
      problems.push(`${switchFile}: 指す先 ./${target}.ts(x) が無い`);
      continue;
    }
    switches.push({ path: switchFile, target, point: replace.point, declaredIn: replace.declaredIn });
  }
  return { switches, problems };
}
