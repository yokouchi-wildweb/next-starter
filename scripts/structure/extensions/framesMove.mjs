// scripts/structure/extensions/framesMove.mjs
// 枠の宣言の名前の移し替え(pnpm check extensions -- frames-move [--base <rev>] [--apply] [--json]、既定 dry-run)。
// 基準の版(台帳 .notices/applied/<fork_id>.md の最後の upstream:<sha>、--base で上書き)のファイルと照らして、
// - 上流(親)のルートの隣に fork が置いた frame.ts → frame.override.ts(export const frame → export const override)
// - fork 自身が置いた frame.default.ts → frame.ts(export const frameDefault → export const frame)
// 止まる(動かさず挙げる): 行き先が既にある / export の名前が読めない・別の名前 / 基準の版が決まらない(exit 2)。
// 名前の決まり: src/app/_layout/frame/README.md、notice shared-shelf-frame-override

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readBaseFiles } from "../../../src/lib/forkOwnership/baseFiles.mjs";
import { listAppFiles } from "../../../src/lib/screens/routeTree.mjs";
import { FRAME_DEFAULT_FILE, FRAME_FILE, FRAME_OVERRIDE_FILE, readExportedLiteral } from "./frames.mjs";

const USAGE = "pnpm check extensions -- frames-move [--base <rev>] [--apply] [--json]";
const dirOf = (path) => path.slice(0, path.lastIndexOf("/"));
const ROUTE_FILE = /^(page|layout)\.(tsx|ts|jsx|js|mdx)$/;

/** `export const <from>` の宣言の名前だけを <to> に替える(1 つだけあること) */
function renameExport(text, from, to) {
  const re = new RegExp(`(export\\s+const\\s+)${from}\\b`, "g");
  const hits = text.match(re)?.length ?? 0;
  return hits === 1 ? text.replace(re, `$1${to}`) : null;
}

/**
 * @param {string} root
 * @param {{ base?: string }} [opts]
 * @returns {{ base: string, moves: { from: string, to: string, exportFrom: string, exportTo: string, why: string }[], stops: { path: string, why: string }[] } | { problem: string }}
 */
export function planFramesMove(root, { base } = {}) {
  const read = readBaseFiles(root, base);
  if ("problem" in read) return { problem: read.problem };
  const baseFiles = new Set(read.files);
  const baseRouteDirs = new Set(read.files.filter((f) => f.startsWith("src/app/") && ROUTE_FILE.test(f.slice(f.lastIndexOf("/") + 1))).map(dirOf));
  const files = existsSync(join(root, "src/app")) ? listAppFiles(root) : [];
  const present = new Set(files);
  const moves = [];
  const stops = [];
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (baseFiles.has(path)) continue; // 親の物は動かさない
    const dir = dirOf(path);
    let to = null;
    let exportFrom = null;
    let exportTo = null;
    let why = null;
    if (name === FRAME_FILE && baseRouteDirs.has(dir)) {
      [to, exportFrom, exportTo, why] = [`${dir}/${FRAME_OVERRIDE_FILE}`, "frame", "override", "上流(親)のルートの隣の fork の宣言"];
    } else if (name === FRAME_DEFAULT_FILE) {
      [to, exportFrom, exportTo, why] = [`${dir}/${FRAME_FILE}`, "frameDefault", "frame", "fork 自身のルートの宣言(ルートを作ったリポの名前)"];
    } else continue;
    if (present.has(to)) {
      stops.push({ path, why: `行き先 ${to} が既にある(中身を 1 つにまとめてから回す)` });
      continue;
    }
    const text = readFileSync(join(root, path), "utf8");
    const literal = readExportedLiteral(path, text, exportFrom);
    if (literal.problem || renameExport(text, exportFrom, exportTo) === null) {
      stops.push({ path, why: `export const ${exportFrom} = { … } が 1 つだけのリテラルで無い(手で ${to} へ移し export を ${exportTo} にする)` });
      continue;
    }
    moves.push({ from: path, to, exportFrom, exportTo, why });
  }
  return { base: read.rev, moves, stops };
}

/** 移す(git mv → export の名前を替える → git add。コミットは呼ぶ側) */
export function applyFramesMove(root, plan) {
  for (const move of plan.moves) {
    execFileSync("git", ["mv", move.from, move.to], { cwd: root });
    const path = join(root, move.to);
    const text = readFileSync(path, "utf8").replace(`// ${move.from}`, `// ${move.to}`);
    writeFileSync(path, renameExport(text, move.exportFrom, move.exportTo));
    execFileSync("git", ["add", move.to], { cwd: root });
  }
}

/** @returns {number} exit code(0 = 動かす物も止まる物も無いか動かした、1 = 止まる物がある、2 = 基準が決まらない・引数の誤り) */
export function runFramesMove(root, argv = [], { stdout = process.stdout, stderr = process.stderr } = {}) {
  let base;
  let apply = false;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--json") json = true;
    else if (arg === "--base" && argv[i + 1] && !argv[i + 1].startsWith("--")) base = argv[++i];
    else if (arg.startsWith("--base=") && arg.length > 7) base = arg.slice(7);
    else if (arg === "--help") {
      stdout.write(`${USAGE}\n`);
      return 0;
    } else {
      stderr.write(`frames-move: 知らない引数 ${arg}\n${USAGE}\n`);
      return 2;
    }
  }
  const plan = planFramesMove(root, { base });
  if ("problem" in plan) {
    stderr.write(`frames-move: ${plan.problem}\n`);
    return 2;
  }
  if (apply) applyFramesMove(root, plan);
  if (json) stdout.write(`${JSON.stringify({ apply, base: plan.base, moves: plan.moves, stops: plan.stops }, null, 2)}\n`);
  else {
    stdout.write(`frames-move: ${apply ? "移した" : "移す(dry-run、移すのは --apply)"} ${plan.moves.length}・止まる ${plan.stops.length}(基準 ${plan.base})\n`);
    for (const m of plan.moves) stdout.write(`  ${m.from} → ${m.to}(export ${m.exportFrom} → ${m.exportTo}: ${m.why})\n`);
    for (const s of plan.stops) stdout.write(`  止まる: ${s.path}: ${s.why}\n`);
    if (apply && plan.moves.length > 0) stdout.write("次: pnpm generate extensions(枠の表と intake)→ pnpm check extensions\n");
  }
  return plan.stops.length > 0 ? 1 : 0;
}
