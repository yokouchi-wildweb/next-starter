// /flux: 取り込む上流の変更が、自分の打ち消し(overrides:)が名指す祖先の鍵に触れたかを見る(SKILL.md「STOP CONDITIONS」)。
// 判定の中身は src/lib/forkOwnership/lineage.mjs の touchedOverrides(純関数)。ここは git から 2 版の lineage.md を読むだけ。
//
// 使い方: node .claude/skills/flux/lineage-touch.mjs --before <ref> --after <ref> [--json]
//   before = 区間の merge 前の HEAD、after = 区間の上流の到達点(区切り点)
//   打ち消しは作業ツリーの .claude/rules/project.md と、after(無ければ before)の lineage.md の自分の節から読む
// 終了コード: 0 = 触れない / 1 = 触れた(人に確かめる)/ 2 = 引数・git・自分の名前が読めない
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { PROJECT_RULES_FILE, readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { LINEAGE_FILE, touchedOverrides } from "../../../src/lib/forkOwnership/lineage.mjs";

/** <ref> の lineage.md(無ければ null。ref が無いのは throw) */
function showLineage(cwd, ref) {
  execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  try {
    return execFileSync("git", ["show", `${ref}:${LINEAGE_FILE}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

/**
 * @param {{ cwd?: string, before: string, after: string }} args
 * @returns {{ own: string, touched: ReturnType<typeof touchedOverrides> }}
 */
export function lineageTouch({ cwd = process.cwd(), before, after }) {
  const { own } = readForkIdentity(cwd);
  if (!own) throw new Error(`${PROJECT_RULES_FILE} の fork_id: が読めない`);
  const projectPath = join(cwd, PROJECT_RULES_FILE);
  const projectText = existsSync(projectPath) ? readFileSync(projectPath, "utf8") : "";
  return { own, touched: touchedOverrides({ before: showLineage(cwd, before), after: showLineage(cwd, after), projectText, own }) };
}

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--before" || arg === "--after") {
      const value = argv[(i += 1)];
      if (!value) throw new Error(`${arg} の値が無い`);
      args[arg.slice(2)] = value;
    } else throw new Error(`不明な引数: ${arg}`);
  }
  if (!args.before || !args.after) throw new Error("使い方: node .claude/skills/flux/lineage-touch.mjs --before <ref> --after <ref> [--json]");
  return args;
}

function main() {
  let args;
  let result;
  try {
    args = parseArgs(process.argv.slice(2));
    result = lineageTouch(args);
  } catch (error) {
    console.error(`lineage-touch: ${error.stderr || error.message}`);
    process.exit(2);
  }
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const t of result.touched) console.log(`touched: ${t.target} (${t.change}) | ${t.where} | before: ${t.before} | after: ${t.after ?? "-"}`);
    console.log(`result: ${result.touched.length > 0 ? "touched" : "none"}`);
  }
  process.exit(result.touched.length > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
