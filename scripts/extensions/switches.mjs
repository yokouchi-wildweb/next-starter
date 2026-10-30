// scripts/extensions/switches.mjs
// 1 行スイッチの検査: 既定 <名前>.default.ts(x)(上流)の隣の素の名前 <名前>.ts(x) = 呼び手が import する口で、採用者所有の 1 行 re-export。
// 中身(コメントを除く)は ./<名前>.default か ./<名前>.<宣言済みの fork の名前> を指す re-export 1 文だけ。Tier1 は .default を指す。
// fork の実装 = <名前>.<fork の名前>.ts(x)。page.tsx・layout.tsx のスイッチ(_screen / _components を指す)は test:screens の側。書式: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { stripComments } from "../../src/lib/screens/checks.mjs";

import { SEARCH_ROOT } from "./declarations.mjs";

const DEFAULT_FILE = /^([A-Za-z][A-Za-z0-9]*)\.default\.(ts|tsx)$/;
const REEXPORT = /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*["']\.\/([^"'/]+)["']\s*;?$/;

/** src の下の <名前>.default.ts(x) を集める */
function findDefaults(repoRoot) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(join(repoRoot, dir))) return;
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(`${dir}/${entry.name}`);
      } else if (DEFAULT_FILE.test(entry.name)) {
        found.push(`${dir}/${entry.name}`);
      }
    }
  };
  walk(SEARCH_ROOT);
  return found.sort();
}

/**
 * スイッチを全部検査する
 * @param {string} repoRoot
 * @param {{ forkIds: string[], isTier1: boolean }} identity forkIds = 宣言済みの fork の名前(自分と祖先)
 * @returns {{ switches: { path: string, target: string }[], problems: string[] }}
 */
export function checkSwitches(repoRoot, { forkIds, isTier1 }) {
  const switches = [];
  const problems = [];
  for (const defaultPath of findDefaults(repoRoot)) {
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
      problems.push(`${switchFile}: スイッチは re-export 1 文だけ(export … from "./${name}.default" か "./${name}.<fork の名前>")。処理は既定か fork の実装に書く`);
      continue;
    }
    const target = match[1].replace(/\.(ts|tsx)$/, "");
    if (target !== `${name}.default`) {
      const forkId = target.startsWith(`${name}.`) ? target.slice(name.length + 1) : null;
      if (forkId === null || forkId.includes(".")) {
        problems.push(`${switchFile}: 指す先 ./${target} は ${name}.default か ${name}.<fork の名前> だけ`);
        continue;
      }
      if (!forkIds.includes(forkId)) {
        problems.push(`${switchFile}: fork の名前 "${forkId}" は宣言されていない(.claude/rules/project.md の fork_id: か祖先の台帳名)`);
        continue;
      }
      if (isTier1) {
        problems.push(`${switchFile}: 上流(Tier1)のスイッチは ${name}.default を指す(fork の実装は fork が切り替える)`);
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
