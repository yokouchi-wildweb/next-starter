#!/usr/bin/env node
// /flux 中継判定の機械部分(relay.md「中継判定」の ① ハンクの重なり と ② 適用作業での上流変更ファイル外の変更)。
// ③ required_actions からの逸脱 は適用したセッションが知っている事実なので、呼び出し側(/flux)が足す。
//
// 使い方: node .claude/skills/flux/relay-check.mjs --p <P> --q <Q> --applied-from <A> [--json]
//   P = 上流履歴上で直前の notice の区切り点(無ければ fork 成立点)
//   Q = その notice の区切り点
//   A = 区間の merge 直後の HEAD(merge コミット / fast-forward の到達点 / 区間 0 なら区間開始時の HEAD)
// 終了コード: 0 = 中継不要 / 1 = 中継が必要 / 2 = 引数・git のエラー
//
// ① 上流のハンク(P→Q の Q 側の行範囲)と fork のハンク(Q→作業ツリーの Q 側の行範囲)が
//    同じファイルで重なるか接していれば該当。接していても数えるのは git の 3-way merge が衝突とみなす基準と揃えるため。
//    上流がファイルを追加・削除したファイル、ハンクの無い差分(バイナリ・mode 変更)はファイル全体を範囲とみなす。
// ② A→作業ツリー(未追跡を含む)で変わったファイルのうち、上流が P→Q で変えていないもの。
// どちらも .notices/ と lock ファイル(package.json から生成される派生物)を対象外にする。
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const IGNORED_FILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
const PATHSPEC_EXCLUDES = [":(exclude).notices", ...IGNORED_FILES.map((f) => `:(exclude,glob)**/${f}`)];

function git(cwd, args, { allowExit1 = false } = {}) {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
      cwd,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowExit1 && error.status === 1) return error.stdout;
    throw error;
  }
}

function splitZ(output) {
  return output.split("\0").filter((s) => s.length > 0);
}

// `git diff --name-status -z` → [{ status, path }](--no-renames 前提なので 1 エントリ = 1 パス)
function parseNameStatusZ(output) {
  const parts = splitZ(output);
  const entries = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    entries.push({ status: parts[i][0], path: parts[i + 1] });
  }
  return entries;
}

// -U0 の hunk ヘッダーから、指定した側(old = "-" / new = "+")の Q 座標の半開区間 [start, end) を取り出す。
// 行数 0 の側(純粋な挿入・削除)は「行 start の直後」= 境界 start+1 に幅 0 の区間を置く。
export function parseHunkRanges(diffText, side) {
  const ranges = [];
  const re = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm;
  for (const m of diffText.matchAll(re)) {
    const start = Number(side === "old" ? m[1] : m[3]);
    const countRaw = side === "old" ? m[2] : m[4];
    const count = countRaw === undefined ? 1 : Number(countRaw);
    ranges.push(count === 0 ? [start + 1, start + 1] : [start, start + count]);
  }
  return ranges;
}

// 重なるか接していれば true(行 2 までの変更と行 3 からの変更も接するとみなす)
export function rangesTouch(a, b) {
  return a[0] <= b[1] && b[0] <= a[1];
}

function formatRanges(ranges) {
  if (ranges === "whole") return "whole-file";
  return ranges.map(([s, e]) => (e - s <= 1 ? `${s}` : `${s}-${e - 1}`)).join(",");
}

function literal(path) {
  return `:(literal)${path}`;
}

export function relayCheck({ cwd = process.cwd(), p, q, appliedFrom }) {
  const upstreamEntries = parseNameStatusZ(
    git(cwd, ["diff", "--no-renames", "--name-status", "-z", p, q, "--", ".", ...PATHSPEC_EXCLUDES]),
  );
  const upstreamPaths = new Set(upstreamEntries.map((e) => e.path));
  const untracked = splitZ(git(cwd, ["ls-files", "--others", "--exclude-standard", "-z", "--", ".", ...PATHSPEC_EXCLUDES]));
  const untrackedSet = new Set(untracked);

  // ① ハンクの重なり
  const overlaps = [];
  for (const { status, path } of upstreamEntries) {
    const forkDiff = git(cwd, ["diff", "--no-renames", "-U0", q, "--", literal(path)]);
    const forkChanged = forkDiff.length > 0 || untrackedSet.has(path);
    if (!forkChanged) continue;

    const forkRanges = parseHunkRanges(forkDiff, "old");
    // 上流の追加・削除、ハンクの無い差分(バイナリ・mode 変更)はファイル全体を範囲とみなす
    const upstreamRanges =
      status === "A" || status === "D"
        ? []
        : parseHunkRanges(git(cwd, ["diff", "--no-renames", "-U0", p, q, "--", literal(path)]), "new");
    const upstreamWhole = upstreamRanges.length === 0;
    // 未追跡、または Q に無いファイル(上流が削除)を fork が持っている
    const forkWhole = forkRanges.length === 0 || status === "D";
    if (upstreamWhole || forkWhole) {
      overlaps.push({
        path,
        upstream: upstreamWhole ? "whole" : upstreamRanges,
        fork: forkWhole ? "whole" : forkRanges,
      });
      continue;
    }
    const hitUp = upstreamRanges.filter((u) => forkRanges.some((f) => rangesTouch(u, f)));
    if (hitUp.length > 0) {
      const hitFork = forkRanges.filter((f) => upstreamRanges.some((u) => rangesTouch(u, f)));
      overlaps.push({ path, upstream: hitUp, fork: hitFork });
    }
  }

  // ② 適用作業での上流変更ファイル外の変更
  const appliedPaths = new Set([
    ...parseNameStatusZ(
      git(cwd, ["diff", "--no-renames", "--name-status", "-z", appliedFrom, "--", ".", ...PATHSPEC_EXCLUDES]),
    ).map((e) => e.path),
    ...untracked,
  ]);
  const outside = [...appliedPaths].filter((path) => !upstreamPaths.has(path)).sort();

  return { needed: overlaps.length > 0 || outside.length > 0, overlaps, outside };
}

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--p") args.p = argv[++i];
    else if (a === "--q") args.q = argv[++i];
    else if (a === "--applied-from") args.appliedFrom = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!args.p || !args.q || !args.appliedFrom) {
    throw new Error("usage: relay-check.mjs --p <P> --q <Q> --applied-from <A> [--json]");
  }
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  let result;
  try {
    result = relayCheck(args);
  } catch (error) {
    console.error(`relay-check: git failed: ${error.stderr || error.message}`);
    process.exit(2);
  }
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const o of result.overlaps) {
      console.log(`overlap: ${o.path} | upstream:${formatRanges(o.upstream)} | fork:${formatRanges(o.fork)}`);
    }
    for (const path of result.outside) console.log(`outside: ${path}`);
    console.log(`result: ${result.needed ? "needed" : "none"}`);
  }
  process.exit(result.needed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
