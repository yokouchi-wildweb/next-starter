// /flux: 取り込む上流の変更が、自分の打ち消し(overrides:)が名指す祖先の鍵に触れたかを見る(SKILL.md「STOP CONDITIONS」)。
// 判定の中身は src/lib/forkOwnership/lineage.mjs の touchedOverrides(純関数)。ここは git から 2 版の lineage.md を読むだけ。
//
// 使い方: node .flux/lineage-touch.mjs --upstream <ref> --before <ref> --after <ref> [--json]
//   /flux は上流の先端の版を .flux/ に取り出して回す(SKILL.md 5a)
//   upstream = 判定の lib(lineage.mjs・forkIds.mjs)を読む上流の ref: fork の作業ツリーでなくその版を .flux/flux-lib/<sha>/ に
//     取り出して読む(lineage.mjs の無い古い fork でも動く。写しは作らない)。無ければこのスクリプトの隣の repo の lib(上流自身・テスト)
//   before = 区間の merge 前の HEAD、after = 区間の上流の到達点(区切り点)
//   打ち消しは作業ツリーの .claude/rules/project.md と、after(無ければ before)の lineage.md の自分の節から読む
// 終了コード: 0 = 触れない / 1 = 触れた(人に確かめる)/ 2 = 引数・git・自分の名前が読めない
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const LIB_DIR = "src/lib/forkOwnership";
const LIB_FILES = ["forkIds.mjs", "lineage.mjs"]; // lineage.mjs が読むのは ./forkIds.mjs だけ

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** 判定の lib: upstream があればその版を .flux/flux-lib/<sha>/ に取り出して、無ければこの repo の lib を読む */
async function loadLibs(cwd, upstream) {
  if (!upstream) {
    return {
      ids: await import(`../../../${LIB_DIR}/forkIds.mjs`),
      lineage: await import(`../../../${LIB_DIR}/lineage.mjs`),
    };
  }
  const sha = git(cwd, ["rev-parse", "--verify", "--quiet", `${upstream}^{commit}`]).trim();
  const dir = join(cwd, ".flux", "flux-lib", sha);
  mkdirSync(dir, { recursive: true });
  for (const file of LIB_FILES) {
    const out = join(dir, file);
    if (!existsSync(out)) writeFileSync(out, git(cwd, ["show", `${sha}:${LIB_DIR}/${file}`]));
  }
  return {
    ids: await import(pathToFileURL(join(dir, "forkIds.mjs")).href),
    lineage: await import(pathToFileURL(join(dir, "lineage.mjs")).href),
  };
}

/** <ref> の lineage.md(無ければ null。ref が無いのは throw) */
function showLineage(cwd, ref, LINEAGE_FILE) {
  execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  try {
    return execFileSync("git", ["show", `${ref}:${LINEAGE_FILE}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

/**
 * @param {{ cwd?: string, upstream?: string, before: string, after: string }} args
 * @returns {Promise<{ own: string, touched: ReturnType<import("../../../src/lib/forkOwnership/lineage.mjs").touchedOverrides> }>}
 */
export async function lineageTouch({ cwd = process.cwd(), upstream, before, after }) {
  const { ids, lineage } = await loadLibs(cwd, upstream);
  const { own } = ids.readForkIdentity(cwd);
  if (!own) throw new Error(`${ids.REPO_JSON_FILE} の repo_id が読めない`);
  const projectPath = join(cwd, ids.PROJECT_RULES_FILE);
  const projectText = existsSync(projectPath) ? readFileSync(projectPath, "utf8") : "";
  const show = (ref) => showLineage(cwd, ref, lineage.LINEAGE_FILE);
  return { own, touched: lineage.touchedOverrides({ before: show(before), after: show(after), projectText, own }) };
}

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--before" || arg === "--after" || arg === "--upstream") {
      const value = argv[(i += 1)];
      if (!value) throw new Error(`${arg} の値が無い`);
      args[arg.slice(2)] = value;
    } else if (arg.startsWith("--upstream=")) args.upstream = arg.slice("--upstream=".length);
    else throw new Error(`不明な引数: ${arg}`);
  }
  if (!args.before || !args.after) throw new Error("使い方: node .flux/lineage-touch.mjs [--upstream <ref>] --before <ref> --after <ref> [--json]");
  return args;
}

async function main() {
  let args;
  let result;
  try {
    args = parseArgs(process.argv.slice(2));
    result = await lineageTouch(args);
  } catch (error) {
    console.error(`lineage-touch: ${error.stderr || error.message}`);
    process.exitCode = 2;
    return;
  }
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const t of result.touched) console.log(`touched: ${t.target} (${t.change}) | ${t.where} | before: ${t.before} | after: ${t.after ?? "-"}`);
    console.log(`result: ${result.touched.length > 0 ? "touched" : "none"}`);
  }
  process.exitCode = result.touched.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
