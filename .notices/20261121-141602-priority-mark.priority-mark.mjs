#!/usr/bin/env node
// .notices/20261121-141602-priority-mark.priority-mark.mjs
// lineage の上書きの書式(overrides: と (default))を優先の印 (priority) の行へ書き換える移行(D276)。fork のリポのルートで走らせる。
// 使い方: node .notices/20261121-141602-priority-mark.priority-mark.mjs [--apply]
//   既定は dry-run(書き換えの一覧と止めた一覧を出すだけ)。--apply で書く。何度走らせても同じ結果(2 回目は変更 0)
//
// 触る物:
// - .claude/rules/project.md の `overrides: <owner>.<key> = <value> | why: <reason>`(行頭の `- ` 可)
//   → `- <key> (priority): <value> (why: <reason>)`(同じ場所、字下げはそのまま)
// - .claude/rules/lineage.md の自分の節(## <repo_id> 〜 <!-- end <repo_id> -->)の同じ overrides: の行 → 同じ形(下流へも渡す)
// - 自分の節の `- <key> (default): <rule>` → `- <key>: <rule>`(印を外すだけ)
// 触らない物: 祖先の節(祖先が自分の移行で直し、取り込みで届く)、ほかのファイル
// 止める物(書かずに一覧に出す): 形の違う overrides: の行、repo.json の repo_id が読めない
// fork の手順:
// 1. この notice の区間を /flux で取り込む
// 2. dry-run で一覧を見る → 止めた物は手で同じ形に直す
// 3. --apply → git diff で確かめてコミット(行の意味は変わらない: 下の段の行が祖先の鍵より先に読まれるのは印の決まり、core/design.md priority)
// 4. 多段の Tier: 中間 Tier が先に移して出荷し、下の Tier はそれを取り込んでから自分の分を移す
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { readForkIdentity } from "../src/lib/forkOwnership/forkIds.mjs";

export const PROJECT_FILE = ".claude/rules/project.md";
export const LINEAGE_FILE = ".claude/rules/lineage.md";
const OVERRIDE_LINE = /^(\s*)(?:- )?overrides:\s*(.*)$/;
const OVERRIDE_BODY = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([A-Za-z0-9_-]+)\s*=\s*(.*?)\s*\|\s*why:\s*(.*?)\s*$/;
const DEFAULT_KEY = /^(\s*- [A-Za-z0-9_-]+) \(default\):/;

/** overrides: の 1 行を印の行へ。形が違えば null */
export const markLine = (line) => {
  const m = OVERRIDE_LINE.exec(line);
  if (!m) return undefined;
  const body = OVERRIDE_BODY.exec(m[2].trim());
  if (!body) return null;
  const [, , key, value, why] = body;
  if (value === "" || why === "") return null;
  return `${m[1]}- ${key} (priority): ${value} (why: ${why})`;
};

/**
 * 1 つのファイルの文を書き換える。inRange(行番号 0 始まり) が真の行だけ見る
 * @returns {{ text: string, changes: { line: number, before: string, after: string }[], stopped: { line: number, text: string }[] }}
 */
export const rewrite = (text, { inRange = () => true, dropDefault = false } = {}) => {
  const lines = text.split("\n");
  const changes = [];
  const stopped = [];
  lines.forEach((line, i) => {
    if (!inRange(i)) return;
    const marked = markLine(line);
    if (marked === null) stopped.push({ line: i + 1, text: line });
    else if (marked !== undefined) {
      changes.push({ line: i + 1, before: line, after: marked });
      lines[i] = marked;
    } else if (dropDefault && DEFAULT_KEY.test(line)) {
      const after = line.replace(DEFAULT_KEY, "$1:");
      changes.push({ line: i + 1, before: line, after });
      lines[i] = after;
    }
  });
  return { text: lines.join("\n"), changes, stopped };
};

/** lineage.md の自分の節の行(0 始まり)か */
export const ownSection = (text, own) => {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${own}`);
  if (start < 0) return () => false;
  const end = lines.findIndex((l, i) => i > start && l.trim() === `<!-- end ${own} -->`);
  return (i) => i > start && (end < 0 || i < end);
};

/** 計画: ファイルごとの書き換えと止めた物 */
export const plan = (root) => {
  const { own } = readForkIdentity(root);
  if (!own) return { error: "repo.json の repo_id が読めない(pnpm workflow repo-json show で確かめる)", files: [] };
  const files = [];
  const project = join(root, PROJECT_FILE);
  if (existsSync(project)) files.push({ path: PROJECT_FILE, ...rewrite(readFileSync(project, "utf8")) });
  const lineage = join(root, LINEAGE_FILE);
  if (existsSync(lineage)) {
    const text = readFileSync(lineage, "utf8");
    files.push({ path: LINEAGE_FILE, ...rewrite(text, { inRange: ownSection(text, own), dropDefault: true }) });
  }
  return { own, files };
};

/** 書く(変わったファイルだけ) */
export const apply = (root, planned) => {
  for (const f of planned.files) if (f.changes.length) writeFileSync(join(root, f.path), f.text);
};

const main = () => {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--apply");
  if (unknown.length) {
    console.error(`知らない引数: ${unknown.join(" ")}`);
    process.exit(2);
  }
  const root = process.cwd();
  const planned = plan(root);
  if (planned.error) {
    console.error(`止めた: ${planned.error}`);
    process.exit(2);
  }
  let count = 0;
  for (const f of planned.files) {
    for (const c of f.changes) {
      count++;
      console.log(`${f.path}:${c.line}\n  - ${c.before.trim()}\n  + ${c.after.trim()}`);
    }
    for (const s of f.stopped) console.log(`止めた ${f.path}:${s.line}(形が違う overrides:、手で直す): ${s.text.trim()}`);
  }
  console.log(`変更 ${count} 行 / 止めた ${planned.files.reduce((n, f) => n + f.stopped.length, 0)} 行${args.includes("--apply") ? "" : "(dry-run: --apply で書く)"}`);
  if (args.includes("--apply")) apply(root, planned);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
