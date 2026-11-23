#!/usr/bin/env node
// .notices/20261123-151428-root-files.forks.mjs
// 区切り root-files(notice 20261123-151428-root-files の道具。直下のファイルの 3 つの形)で fork が要る手当てを 1 回で当てる道具。
// fork のリポのルートで、上流の区切り root-files の区間を取り込んだ(merge した)後に走らせる。
// 使い方: node .notices/20261123-151428-root-files.forks.mjs [--apply] [--json] [--from <親の前の版>] [--to <取り込んだ親の版>]
//   既定は dry-run(表を出すだけ、何も書かない)。--apply で書く。止めた物があれば終了コード 1。2 回目は何もしない
//   --from / --to の既定: HEAD が取り込みの merge なら --to = HEAD^2、--from = HEAD^1 と HEAD^2 の分岐点。merge でなければ両方を指定する
//   読むのはこのリポだけ(親の版は git show、ネットに出ない)。ホームのファイル(~/.claude.json)は書かない(打つ 1 行を出す)
//
// 順に当てる:
//  1. eslint: 中身のある eslint.config.fork.mjs → その import と配列を素の eslint.config.mjs の本体の後ろへ(`[...core, ...<配列>]`)、ファイルは消す。
//     空の配列なら消すだけ。`export default <名前|配列>` の形で読めなければ止める。素の eslint.config.mjs が上流の 1 行でなければ止める
//  2. next: ./next.config.core を読まない素の next.config.ts → 親の前の版との差から書き直す: nextConfig のオブジェクトに足した行 →
//     `{ ...core, <足した行> }`、export の包み(`export default wrap(nextConfig, …)`)はそのまま、足した import は残す。
//     上流の行を消した・書き換えた等のほかの差 → 差を出して止める(推し量らない)
//  3. playwright: 自分の playwright.config.ts は残す(本体を読まなくてよい)。package.json の scripts.e2e の `-c playwright.config.default.ts` は外す
//  4. 行のファイル(.gitignore・.env.example): 印の行より上にある fork の行(親の版に無い行、順のまま)を印の下へ。親の行を消した・変えた → 止める
//  5. JSON(package.json・.mcp.json・firebase.json): 所有の検査の judgeJsonAppend で見る。.mcp.json の上流の値の変更 → 親の値に戻し、
//     マシンの指定を ~/.claude.json に置く `claude mcp add-json --scope local <名前> '<json>'` を出す。ほかの上流の値の変更 → 止めて鍵を名指す
//
// fork の手順: 区間を取り込む(衝突は /flux 5c: 設定 3 本は自分の版、eslint.config.fork.mjs の消す/変えたの衝突は自分の版を残して git add)→
//   dry-run → --apply → 出た 1 行・止めた物を手で → pnpm workflow ownership check・pnpm check next-config

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { judgeJsonAppend } from "../src/lib/forkOwnership/judge.mjs";

export const MARKER = "# fork entries below (upstream never edits below this line)";
export const LINE_FILES = [".gitignore", ".env.example"];
export const JSON_FILES = ["package.json", ".mcp.json", "firebase.json"];
const ESLINT_FORK = "eslint.config.fork.mjs";
const CORE_IMPORT = /from\s+["']\.\/next\.config\.core["']/;
const ESLINT_CORE_IMPORT = /from\s+["']\.\/eslint\.config\.core\.mjs["']/;
const PLAYWRIGHT_CORE_IMPORT = /from\s+["']\.\/playwright\.config\.core["']/;

/** @typedef {{ part: string, path: string, action: "write" | "remove" | "ok" | "note" | "stop", detail: string, content?: string }} Step */

const git = (/** @type {string} */ root, /** @type {string[]} */ args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};
const show = (/** @type {string} */ root, /** @type {string} */ rev, /** @type {string} */ path) => git(root, ["show", `${rev}:${path}`]);
const readOrNull = (/** @type {string} */ root, /** @type {string} */ path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null);
const lines = (/** @type {string} */ text) => text.replace(/\n+$/, "").split("\n");

/**
 * --from / --to の既定(HEAD が merge なら HEAD^2 と分岐点)
 * @param {string} root
 * @param {{ from?: string | null, to?: string | null }} revs
 * @returns {{ from: string, to: string } | { error: string }}
 */
export function resolveRevs(root, { from = null, to = null }) {
  if (from && to) return { from, to };
  const parents = (git(root, ["rev-list", "--parents", "-n", "1", "HEAD"]) ?? "").trim().split(" ").slice(1);
  if (parents.length !== 2) return { error: "HEAD が取り込みの merge でない: --from <親の前の版> と --to <取り込んだ親の版> を指定する" };
  const base = git(root, ["merge-base", parents[0], parents[1]])?.trim();
  if (!base) return { error: "HEAD^1 と HEAD^2 の分岐点が無い: --from を指定する" };
  return { from: from ?? base, to: to ?? parents[1] };
}

/**
 * 行の最長共通部分列の対応(差の行を出す)。a の各行が b のどこに当たるか(当たらなければ -1)
 * @param {string[]} a
 * @param {string[]} b
 */
function lcsMatch(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const aToB = new Array(a.length).fill(-1);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      aToB[i] = j;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
    else j += 1;
  }
  return aToB;
}

/**
 * 1. eslint
 * @param {{ fork: string | null, plain: string | null, parentPlain: string | null }} texts
 * @returns {Step[]}
 */
export function planEslint({ fork, plain, parentPlain }) {
  if (fork === null) return [{ part: "eslint", path: ESLINT_FORK, action: "ok", detail: "無い(移し済み)" }];
  if (plain !== null && parentPlain !== null && plain !== parentPlain && !ESLINT_CORE_IMPORT.test(plain)) {
    return [{ part: "eslint", path: "eslint.config.mjs", action: "stop", detail: "素の eslint.config.mjs が上流の版でも本体を読む形でもない: 手で本体の後ろに足す形へ" }];
  }
  if (plain !== null && parentPlain !== null && plain !== parentPlain) {
    return [{ part: "eslint", path: ESLINT_FORK, action: "stop", detail: "素の eslint.config.mjs は既に自分の版: eslint.config.fork.mjs の残りを手で移して消す" }];
  }
  const body = lines(fork);
  const at = body.findIndex((line) => /^export default\b/.test(line));
  if (at === -1) return [{ part: "eslint", path: ESLINT_FORK, action: "stop", detail: "export default が無い: 手で素の eslint.config.mjs へ" }];
  const exported = body[at].replace(/^export default\s*/, "");
  let name;
  /** @type {string[]} */
  let rest;
  if (/^[A-Za-z_$][\w$]*;?\s*$/.test(exported)) {
    name = exported.replace(/;?\s*$/, "");
    rest = [...body.slice(0, at), ...body.slice(at + 1)];
    const empty = new RegExp(`^\\s*(?:const|let)\\s+${name}(?:\\s*:[^=]+)?\\s*=\\s*\\[\\s*\\];?\\s*$`);
    if (rest.some((line) => empty.test(line)) && !rest.some((line) => new RegExp(`\\b${name}\\.push\\b`).test(line))) {
      return [{ part: "eslint", path: ESLINT_FORK, action: "remove", detail: "空の配列: 消すだけ(素の版は上流の 1 行のまま)" }];
    }
  } else if (/^\[/.test(exported)) {
    if (/^\[\s*\];?\s*$/.test(exported)) return [{ part: "eslint", path: ESLINT_FORK, action: "remove", detail: "空の配列: 消すだけ(素の版は上流の 1 行のまま)" }];
    name = "forkConfig";
    rest = [...body.slice(0, at), `const forkConfig = ${exported}`, ...body.slice(at + 1)];
  } else {
    return [{ part: "eslint", path: ESLINT_FORK, action: "stop", detail: `読めない export の形(${exported.slice(0, 60)}): 手で素の eslint.config.mjs へ` }];
  }
  const content = [
    "// eslint.config.mjs — このリポの ESLint の設定(型 5 self)。Tier1 の本体 eslint.config.core.mjs を読み、後ろに自分の設定を足す",
    "// (区切り root-files の道具が eslint.config.fork.mjs から移した。全 Tier の必須の規則は pnpm check eslint が守る)",
    'import core from "./eslint.config.core.mjs";',
    ...rest,
    "",
    `export default [...core, ...${name}];`,
    "",
  ].join("\n");
  return [
    { part: "eslint", path: "eslint.config.mjs", action: "write", detail: `eslint.config.fork.mjs の設定(${name})を本体の後ろに足す`, content },
    { part: "eslint", path: ESLINT_FORK, action: "remove", detail: "中身は素の eslint.config.mjs へ移した" },
  ];
}

/**
 * 2. next
 * @param {{ plain: string | null, prev: string | null }} texts plain = 今の素の next.config.ts、prev = 親の前の版の next.config.ts(全文の頃)
 * @returns {Step[]}
 */
export function planNext({ plain, prev }) {
  const path = "next.config.ts";
  if (plain === null) return [{ part: "next", path, action: "stop", detail: "素の next.config.ts が無い(型 5 で必ず持つ): 上流の 1 行の版を置く" }];
  if (CORE_IMPORT.test(plain)) return [{ part: "next", path, action: "ok", detail: "本体を読む形" }];
  if (prev === null) return [{ part: "next", path, action: "stop", detail: "親の前の版の next.config.ts が読めない: --from を確かめる" }];
  const mine = lines(plain);
  const old = lines(prev);
  const mineToOld = lcsMatch(mine, old);
  const oldMatched = new Set(mineToOld.filter((j) => j >= 0));
  const removed = old.map((line, j) => ({ line, j })).filter(({ j }) => !oldMatched.has(j));
  const removedOk = removed.every(({ line }) => /^export default nextConfig;?\s*$/.test(line) || line.trim() === "");
  if (!removedOk) {
    return [{ part: "next", path, action: "stop", detail: `上流の行を消した・書き換えた(${removed.filter(({ line }) => line.trim() !== "").map(({ line }) => line.trim()).slice(0, 3).join(" / ")}): 手で本体を読む形へ` }];
  }
  const objStart = mine.findIndex((line) => /^const nextConfig\b.*=\s*\{\s*$/.test(line));
  const objEnd = objStart === -1 ? -1 : mine.findIndex((line, i) => i > objStart && /^\};?\s*$/.test(line));
  /** @type {string[]} */
  const imports = [];
  /** @type {string[]} */
  const keys = [];
  /** @type {string[]} */
  const others = [];
  /** @type {string[]} */
  let exportLines = [];
  for (let i = 0; i < mine.length; i += 1) {
    if (mineToOld[i] !== -1) continue;
    const line = mine[i];
    if (/^export default\b/.test(line)) {
      exportLines = [line];
      while (i + 1 < mine.length && mineToOld[i + 1] === -1) exportLines.push(mine[(i += 1)]);
    } else if (objStart !== -1 && i > objStart && i < objEnd) keys.push(line);
    else if (/^import\b/.test(line)) imports.push(line);
    else if (line.trim() === "" || /^\s*\/\//.test(line)) others.push(line);
    else return [{ part: "next", path, action: "stop", detail: `読めない足し分(${line.trim().slice(0, 60)}): 手で本体を読む形へ` }];
  }
  if (keys.length === 0 && exportLines.length === 0 && imports.length === 0) {
    return [{ part: "next", path, action: "stop", detail: "本体を読まないが親の前の版との差が無い: 上流の 1 行の版に戻す(git checkout <取り込んだ版> -- next.config.ts)" }];
  }
  const content = [
    "// next.config.ts — このリポの Next の設定(型 5 self)。Tier1 の本体 next.config.core.ts を読み、足す・包む",
    "// (区切り root-files の道具が前の版の足し分から書き直した)",
    'import type { NextConfig } from "next";',
    ...imports,
    "",
    'import core from "./next.config.core";',
    ...others.filter((line) => line.trim() !== ""),
    "",
    "const nextConfig: NextConfig = {",
    "  ...core,",
    ...keys,
    "};",
    "",
    ...(exportLines.length > 0 ? exportLines : ["export default nextConfig;"]),
    "",
  ].join("\n");
  return [{ part: "next", path, action: "write", detail: `本体を読む形へ(足した鍵 ${keys.filter((l) => /^\s*[\w"']+\s*:/.test(l)).length}・包み ${exportLines.length > 0 ? "あり" : "なし"}・import ${imports.length})`, content }];
}

/**
 * 3. playwright
 * @param {{ plain: string | null, packageJson: string | null }} texts
 * @returns {Step[]}
 */
export function planPlaywright({ plain, packageJson }) {
  /** @type {Step[]} */
  const steps = [];
  if (plain === null) steps.push({ part: "playwright", path: "playwright.config.ts", action: "stop", detail: "素の playwright.config.ts が無い(型 5 で必ず持つ): 上流の 1 行の版か自分の設定を置く" });
  else if (!PLAYWRIGHT_CORE_IMPORT.test(plain)) steps.push({ part: "playwright", path: "playwright.config.ts", action: "note", detail: "自分の設定(本体を読まない)のまま残す" });
  else steps.push({ part: "playwright", path: "playwright.config.ts", action: "ok", detail: "本体を読む形" });
  if (packageJson !== null && /playwright test -c playwright\.config\.default\.ts/.test(packageJson)) {
    steps.push({ part: "playwright", path: "package.json", action: "write", detail: "scripts.e2e の -c playwright.config.default.ts を外す", content: packageJson.replace(/playwright test -c playwright\.config\.default\.ts/g, "playwright test") });
  }
  return steps;
}

/**
 * 4. 行のファイル
 * @param {string} path
 * @param {{ mine: string | null, parent: string | null }} texts parent = 取り込んだ親の版(印の行で終わる)
 * @returns {Step[]}
 */
export function planLineFile(path, { mine, parent }) {
  if (mine === null || parent === null) return [{ part: "lines", path, action: "ok", detail: mine === null ? "無い" : "親の版に無い" }];
  const p = lines(parent);
  const markerAt = p.indexOf(MARKER);
  if (markerAt === -1) return [{ part: "lines", path, action: "stop", detail: "取り込んだ親の版に印の行が無い: --to を確かめる" }];
  const m = lines(mine);
  if (m.slice(0, markerAt + 1).join("\n") === p.slice(0, markerAt + 1).join("\n")) return [{ part: "lines", path, action: "ok", detail: "fork の行は印より下" }];
  const parentToMine = lcsMatch(p, m);
  if (parentToMine.some((j) => j === -1)) {
    // 印の行そのもの(衝突の解き方で落ちた物)は道具が戻すので、失った行に数えない
    const lost = p.filter((_, i) => parentToMine[i] === -1 && p[i].trim() !== "" && p[i] !== MARKER);
    if (lost.length > 0) return [{ part: "lines", path, action: "stop", detail: `親の行を消した・変えた(${lost.slice(0, 3).join(" / ")}): 手で親の行を戻し、自分の行を印の下へ` }];
  }
  const used = new Set(parentToMine.filter((j) => j >= 0));
  const own = m.filter((_, j) => !used.has(j));
  while (own.length > 0 && own[0].trim() === "") own.shift();
  while (own.length > 0 && own[own.length - 1].trim() === "") own.pop();
  const content = `${p.join("\n")}\n${own.join("\n")}${own.length > 0 ? "\n" : ""}`;
  return [{ part: "lines", path, action: "write", detail: `fork の行 ${own.filter((l) => l.trim() !== "").length} 行を印の下へ`, content }];
}

/**
 * 5. JSON
 * @param {string} path
 * @param {{ mine: string | null, parent: string | null }} texts parent = 取り込んだ親の版
 * @returns {Step[]}
 */
export function planJson(path, { mine, parent }) {
  if (mine === null || parent === null) return [{ part: "json", path, action: "ok", detail: mine === null ? "無い" : "親の版に無い" }];
  let judged = judgeJsonAppend(path, parent, mine);
  if (judged.reason === "append") return [{ part: "json", path, action: "ok", detail: "鍵を足しただけ" }];
  if (judged.reason !== "json-upstream-key" || path !== ".mcp.json") {
    return [{ part: "json", path, action: "stop", detail: judged.jsonKey ? `上流の値を変えた・消した(鍵 ${judged.jsonKey}): 親の値に戻す(変えたいなら /order <直接の親>)` : "JSON として読めない" }];
  }
  const base = JSON.parse(parent);
  const head = JSON.parse(mine);
  /** @type {string[]} */
  const machine = [];
  for (let guard = 0; judged.reason === "json-upstream-key" && guard < 20; guard += 1) {
    const match = /^mcpServers\.([^.]+)/.exec(judged.jsonKey ?? "");
    if (!match || !base.mcpServers?.[match[1]]) return [{ part: "json", path, action: "stop", detail: `上流の値を変えた(鍵 ${judged.jsonKey}): 手で親の値に戻す` }];
    const name = match[1];
    if (head.mcpServers?.[name] !== undefined) machine.push(`claude mcp add-json --scope local ${name} '${JSON.stringify(head.mcpServers[name])}'`);
    head.mcpServers = { ...(head.mcpServers ?? {}), [name]: base.mcpServers[name] };
    judged = judgeJsonAppend(path, parent, JSON.stringify(head));
  }
  return [
    { part: "json", path, action: "write", detail: "上流のサーバーの指定を親の値に戻す", content: `${JSON.stringify(head, null, 2)}\n` },
    ...machine.map((line) => /** @type {Step} */ ({ part: "json", path: "~/.claude.json", action: "note", detail: `このマシンで打つ(個人の置き場に残す): ${line}` })),
  ];
}

/**
 * 全部の計画
 * @param {string} root
 * @param {{ from: string, to: string }} revs
 * @returns {Step[]}
 */
export function plan(root, { from, to }) {
  return [
    ...planEslint({ fork: readOrNull(root, ESLINT_FORK), plain: readOrNull(root, "eslint.config.mjs"), parentPlain: show(root, to, "eslint.config.mjs") }),
    ...planNext({ plain: readOrNull(root, "next.config.ts"), prev: show(root, from, "next.config.ts") }),
    ...planPlaywright({ plain: readOrNull(root, "playwright.config.ts"), packageJson: readOrNull(root, "package.json") }),
    ...LINE_FILES.flatMap((path) => planLineFile(path, { mine: readOrNull(root, path), parent: show(root, to, path) })),
    ...JSON_FILES.flatMap((path) => planJson(path, { mine: readOrNull(root, path), parent: show(root, to, path) })),
  ];
}

/**
 * 書く(write と remove だけ)。同じ path の write が 2 つ(package.json の e2e と JSON)にはならない: JSON の書き直しは .mcp.json だけ
 * @param {string} root
 * @param {Step[]} steps
 */
export function apply(root, steps) {
  for (const step of steps) {
    if (step.action === "write" && step.content !== undefined) writeFileSync(join(root, step.path), step.content);
    if (step.action === "remove") rmSync(join(root, step.path), { force: true });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (/** @type {string} */ name) => {
    const at = argv.indexOf(name);
    return at === -1 ? null : (argv[at + 1] ?? null);
  };
  const root = process.cwd();
  const revs = resolveRevs(root, { from: opt("--from"), to: opt("--to") });
  if ("error" in revs) {
    console.error(revs.error);
    process.exit(2);
  }
  const steps = plan(root, revs);
  if (argv.includes("--json")) console.log(JSON.stringify(steps.map(({ content, ...rest }) => rest), null, 2));
  else for (const step of steps) console.log(`[${step.action}] ${step.part} ${step.path} — ${step.detail}`);
  if (argv.includes("--apply")) apply(root, steps);
  else if (steps.some((step) => step.action === "write" || step.action === "remove")) console.log("(dry-run: --apply で書く)");
  if (steps.some((step) => step.action === "stop")) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
