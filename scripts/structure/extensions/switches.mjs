// scripts/structure/extensions/switches.mjs
// 1 行スイッチの検査: 既定 <名前>.default.ts(x)(上流)の隣の素の名前 <名前>.ts(x) = 呼び手が import する口で、採用者所有の 1 行 re-export。
// 中身(コメントを除く)は ./<名前>.default か ./<名前>.replace を指す re-export 1 文だけ。Tier1 は .default を指す。
// fork の実装 = <名前>.replace.ts(x)(丸ごと置き換え。旧い <名前>.<fork の名前> は止めて移し方を案内する)。
// .default は作ったリポが出す既定の共通の印(D171)。ほかの仕組みが名乗った形(各仕組みの CLAIMED_DEFAULTS、下の CLAIMERS)はスイッチの既定として扱わない。
// 隣に <名前>.default の無い <名前>.replace は孤立で失敗(route の隣 _layout/_screen/_components は pnpm test src/lib/screens/screens.test.mjs の側)。page.tsx・layout.tsx のスイッチ(_screen / _components を指す)は pnpm test src/lib/screens/screens.test.mjs の側。書式: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { oldMarkerProblem } from "../../../src/lib/districtMap/dottedNames.mjs";
import { stripComments } from "../../../src/lib/screens/checks.mjs";

import { SEARCH_ROOT } from "../../../src/lib/districtMap/declarations.mjs";
import { CLAIMED_DEFAULTS as FRAME_CLAIMS } from "./frames.mjs";

/**
 * .default を使うほかの仕組みが名乗るファイルの形(仕組みごとに 1 か所で公開した一覧を足す。.default.css なども同じ形で足せる)
 * @type {readonly { by: string, under: string, name?: string, pattern?: RegExp }[]}
 */
export const CLAIMERS = [...FRAME_CLAIMS];

/** path(リポジトリ直下からの相対)がどれかの仕組みの名乗った形か */
export function isClaimedDefault(path, claims = CLAIMERS) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return claims.some((c) => path.startsWith(`${c.under}/`) && (c.name !== undefined ? name === c.name : c.pattern.test(name)));
}

const DEFAULT_FILE = /^([A-Za-z][A-Za-z0-9]*)\.default\.(ts|tsx)$/;
const REPLACE_FILE = /^(.+)\.replace\.(ts|tsx)$/;
const ROUTE_DIRS = ["_layout", "_screen", "_components"];
const REEXPORT = /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*["']\.\/([^"'/]+)["']\s*;?$/;

/** src の下の <名前>.default.ts(x)(ほかの仕組みが名乗った形を除く)と、route の隣の外の <名前>.replace.ts(x) を集める */
function findDefaults(repoRoot, claims) {
  const found = [];
  const replaces = [];
  const walk = (dir, inRoute) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(`${dir}/${entry.name}`, inRoute || ROUTE_DIRS.includes(entry.name));
      } else if (DEFAULT_FILE.test(entry.name) && !isClaimedDefault(`${dir}/${entry.name}`, claims)) {
        found.push(`${dir}/${entry.name}`);
      } else if (!inRoute && REPLACE_FILE.test(entry.name)) {
        replaces.push(`${dir}/${entry.name}`);
      }
    }
  };
  walk(SEARCH_ROOT, false);
  return { defaults: found.sort(), replaces: replaces.sort() };
}

/**
 * スイッチを全部検査する
 * @param {string} repoRoot
 * @param {{ isTier1: boolean, claims?: readonly object[] }} identity claims = ほかの仕組みが名乗った .default の形(省略 = CLAIMERS)
 * @returns {{ switches: { path: string, target: string }[], problems: string[] }}
 */
export function checkSwitches(repoRoot, { isTier1, claims = CLAIMERS }) {
  const switches = [];
  const problems = [];
  const { defaults, replaces } = findDefaults(repoRoot, claims);
  for (const replacePath of replaces) {
    const dir = replacePath.slice(0, replacePath.lastIndexOf("/"));
    const name = REPLACE_FILE.exec(replacePath.slice(dir.length + 1))[1];
    if (!["ts", "tsx"].some((ext) => existsSync(join(repoRoot, `${dir}/${name}.default.${ext}`)))) {
      problems.push(`${replacePath}: 隣に既定 ${name}.default.ts(x) が無い(孤立した .replace。置き換えられるのは 1 行スイッチの既定だけ)`);
    }
  }
  for (const defaultPath of defaults) {
    const dir = defaultPath.slice(0, defaultPath.lastIndexOf("/"));
    const name = DEFAULT_FILE.exec(defaultPath.slice(dir.length + 1))[1];
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
    switches.push({ path: switchFile, target });
  }
  return { switches, problems };
}
