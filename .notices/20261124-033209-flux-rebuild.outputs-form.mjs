#!/usr/bin/env node
// .notices/20261124-033209-flux-rebuild.outputs-form.mjs
// 生成器の phase.json の outputs を 1 つの形 { glob, kind, source, part? } に書き換える(/flux の作り直し S2、D318)。上流(Tier1)も fork も同じ道具で、
// リポのルートで走らせる(区切り flux-rebuild の notice .notices/20261124-033209-flux-rebuild.md の道具)。
// 使い方: node .notices/20261124-033209-flux-rebuild.outputs-form.mjs [--apply] [--json]
//   既定は dry-run(書き換える phase.json と行の数を出すだけ、何も書かない)。--apply で書く。2 回目は何もしない
//
// 対象: scripts/<種類>/<名前>/phase.json(上流の生成器も fork が足した生成器も)の outputs だけ。ほかの欄・並び・書式は触らない
// - glob の文字列 → { glob, kind: "every-run", source: "<その phase.json>" }(文字列の略記は every-run。source = その生成器の宣言元)
// - kind の無い行 → kind: "every-run"、source の無い行 → every-run は "<その phase.json>"、write-once は WRITE_ONCE_SOURCE
//   (書いた後は持ち主の手書き。message の生成器の宣言と同じ文)。part・ほかの欄はそのまま
// 配列が 1 行に書かれていれば 1 行のまま、複数行なら 1 行 1 項目(元の字下げ)で書く
// 止める物: outputs が配列でない・glob の無い行(人が直す。この道具は書かない)

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = "scripts";
/** write-once の行の source(書いた後は持ち主が手で直す) */
export const WRITE_ONCE_SOURCE = "the written file itself (hand-owned after the first write)";

/** outputs の配列の字面の範囲([ から ] まで)。無ければ null */
export function outputsSpan(text) {
  const key = /"outputs"\s*:\s*\[/.exec(text);
  if (!key) return null;
  const start = key.index + key[0].length - 1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  return null;
}

/**
 * 1 つの phase.json の書き換え(純関数)
 * @param {string} path リポジトリ直下からのパス(source の既定に使う)
 * @param {string} text phase.json の中身
 * @returns {{ state: "apply" | "already" | "none" | "stop", next?: string, lines?: number, reason?: string }}
 */
export function planPhase(path, text) {
  const decl = JSON.parse(text);
  if (decl.outputs === undefined) return { state: "none" };
  if (!Array.isArray(decl.outputs)) return { state: "stop", reason: "outputs が配列でない" };
  let changed = 0;
  const entries = [];
  for (const entry of decl.outputs) {
    if (typeof entry === "string") {
      entries.push({ glob: entry, kind: "every-run", source: path });
      changed++;
      continue;
    }
    if (entry === null || typeof entry !== "object" || typeof entry.glob !== "string" || entry.glob === "") {
      return { state: "stop", reason: `glob の無い行 ${JSON.stringify(entry)}` };
    }
    const kind = entry.kind ?? "every-run";
    const next = { glob: entry.glob, kind, source: entry.source ?? (kind === "write-once" ? WRITE_ONCE_SOURCE : path), ...entry };
    if (entry.kind === undefined || entry.source === undefined) changed++;
    entries.push({ ...next, kind: next.kind, source: next.source });
  }
  if (changed === 0) return { state: "already" };
  const span = outputsSpan(text);
  if (!span) return { state: "stop", reason: "outputs の配列の字面が読めない" };
  const original = text.slice(span.start, span.end);
  const rendered = entries.map((entry) => JSON.stringify(entry).replace(/":/g, '": ').replace(/,"/g, ', "'));
  let block;
  if (!original.includes("\n")) block = `[${rendered.join(", ")}]`;
  else {
    const indent = /\n([ \t]*)\S/.exec(original)?.[1] ?? "    ";
    const closeIndent = /\n([ \t]*)\]$/.exec(original)?.[1] ?? "";
    block = `[\n${rendered.map((line) => `${indent}${line}`).join(",\n")}\n${closeIndent}]`;
  }
  return { state: "apply", next: text.slice(0, span.start) + block + text.slice(span.end), lines: changed };
}

/** scripts/<種類>/<名前>/phase.json の一覧(リポジトリ直下からのパス) */
export function phaseFiles(root) {
  const base = join(root, SCRIPTS_DIR);
  if (!existsSync(base)) return [];
  const found = [];
  for (const kind of readdirSync(base).sort()) {
    const kindDir = join(base, kind);
    if (!statSync(kindDir).isDirectory()) continue;
    for (const name of readdirSync(kindDir).sort()) {
      const rel = `${SCRIPTS_DIR}/${kind}/${name}/phase.json`;
      if (existsSync(join(root, rel))) found.push(rel);
    }
  }
  return found;
}

/** 走らせる(apply = 書く) */
export function run(root, { apply = false } = {}) {
  const results = phaseFiles(root).map((path) => {
    const plan = planPhase(path, readFileSync(join(root, path), "utf8"));
    if (apply && plan.state === "apply") writeFileSync(join(root, path), plan.next);
    return { path, state: plan.state, lines: plan.lines ?? 0, reason: plan.reason };
  });
  return results.filter((r) => r.state !== "none");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const results = run(process.cwd(), { apply });
  if (args.includes("--json")) console.log(JSON.stringify(results, null, 2));
  else {
    for (const r of results) {
      const what = r.state === "apply" ? `${apply ? "書き換えた" : "書き換える"} ${r.lines} 行` : r.state === "already" ? "1 つの形(直す物なし)" : `止めた: ${r.reason}`;
      console.log(`${r.path}: ${what}`);
    }
    if (!apply && results.some((r) => r.state === "apply")) console.log("(dry-run。書くのは --apply)");
  }
  process.exitCode = results.some((r) => r.state === "stop") ? 2 : 0;
}
