#!/usr/bin/env node
// .notices/20261123-192409-cc-cache-standard.search-limit.mjs
// server の search / searchWithDeleted / searchForSorting の limit が型で必須になった(省くと既定 100 で黙って行が落ちていた)
// ことへの移行。fork のリポのルートで走らせる。
// 使い方: node .notices/20261123-192409-cc-cache-standard.search-limit.mjs [--apply]
//   既定は dry-run(足す所と止めた所の一覧を出すだけ)。--apply で書く。何度走らせても同じ結果(2 回目は変更 0)
//
// 触る物(git が追う src/**/*.{ts,tsx,mts}、test を含む): `.search(` / `.searchWithDeleted(` / `.searchForSorting(` の呼び出しで
//   - 引数が無い `x.search()` → `x.search({ limit: 100 })`
//   - 引数が object literal で、その一番上に limit も展開(...)も無い → `limit: 100` を足す(今までの既定の振る舞いのまま)
// 止める物(書かずに一覧に出す): 引数が object literal でない(変数で受け流す)、literal の一番上に展開(...)がある
//   → 意味を読んで手で直す: 外から来る limit は resolveSearchLimit(@/lib/crud)、受け流す型は BoundedSearchParams、
//     1 件を見る物は limit: 1、行の全部が要る物は明示の上限と超えた時の扱い
// 触らない物: client の呼び出し("use client" のファイル・hooks/・services/client/ の下・受け手の名前が Client / client で終わる物。
//   HTTP の limit は server が既定 100・上限 1000 で解く)、文字列の .search(正規表現)
// fork の手順:
// 1. この notice の区間を /flux で取り込む
// 2. dry-run で一覧を見る(止めた物は手で直す)
// 3. --apply → pnpm typecheck(残りは型で落ちる)→ 足した limit: 100 のうち、行の全部が要る読み・1 件を見る読みを読み直す → コミット
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** 対象のファイル */
export const TARGET = /^src\/.+\.(?:ts|tsx|mts)$/;
const CLIENT_PATH = /(^|\/)(hooks|services\/client)\//;
const CALL = /\.(search|searchWithDeleted|searchForSorting)\s*\(/g;
const OPEN = { "(": ")", "{": "}", "[": "]" };

/** 文字列・テンプレート・コメントを飛ばした次の位置(飛ばす物でなければ i) */
const skipLiteral = (text, i) => {
  const c = text[i];
  if (c === "/" && text[i + 1] === "/") {
    const end = text.indexOf("\n", i);
    return end === -1 ? text.length : end;
  }
  if (c === "/" && text[i + 1] === "*") {
    const end = text.indexOf("*/", i + 2);
    return end === -1 ? text.length : end + 2;
  }
  if (c === '"' || c === "'" || c === "`") {
    let j = i + 1;
    while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
    return j + 1;
  }
  return i;
};

/** text[open] の括弧に対応する閉じ括弧の位置(見つからなければ -1) */
const matchClose = (text, open) => {
  const stack = [OPEN[text[open]]];
  let i = open + 1;
  while (i < text.length) {
    const skipped = skipLiteral(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const c = text[i];
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
    i += 1;
  }
  return -1;
};

/** object literal の一番上のキー(と展開があるか) */
function topLevelKeys(text, open, close) {
  const keys = [];
  let spread = false;
  let depth = 0;
  let expectKey = true;
  let i = open + 1;
  while (i < close) {
    const skipped = skipLiteral(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const c = text[i];
    if (OPEN[c]) depth += 1;
    else if (c === ")" || c === "}" || c === "]") depth -= 1;
    else if (depth === 0 && c === ",") expectKey = true;
    else if (depth === 0 && expectKey && /\S/.test(c)) {
      if (text.startsWith("...", i)) spread = true;
      else {
        const m = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
        if (m) keys.push(m[0]);
      }
      expectKey = false;
    }
    i += 1;
  }
  return { keys, spread };
}

/** 文字列・テンプレート・コメントの中の位置の範囲 */
function literalRanges(text) {
  const ranges = [];
  let i = 0;
  while (i < text.length) {
    const skipped = skipLiteral(text, i);
    if (skipped !== i) {
      ranges.push([i, skipped]);
      i = skipped;
    } else i += 1;
  }
  return ranges;
}
const inside = (ranges, index) => ranges.some(([from, to]) => index >= from && index < to);

/** 1 行の番号(1 始まり) */
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** 受け手の名前(`foo.bar.search(` → bar)。名前でなければ null */
function receiverName(text, dot) {
  const m = /([A-Za-z_$][\w$]*)\s*$/.exec(text.slice(0, dot));
  return m ? m[1] : null;
}

/**
 * 1 ファイルの本文を直す
 * @returns {{ text: string, changed: number[], stopped: { line: number, reason: string }[] }}
 */
export function rewrite(source) {
  if (/^\s*["']use client["']/.test(source)) return { text: source, changed: [], stopped: [] };
  const edits = [];
  const changed = [];
  const stopped = [];
  const ranges = literalRanges(source);
  for (const match of source.matchAll(CALL)) {
    const dot = match.index;
    if (inside(ranges, dot)) continue;
    const receiver = receiverName(source, dot);
    if (!receiver || /client$/i.test(receiver)) continue;
    const open = dot + match[0].length - 1;
    const close = matchClose(source, open);
    if (close === -1) continue;
    const inner = source.slice(open + 1, close);
    const line = lineOf(source, dot);
    if (inner.trim() === "") {
      edits.push({ from: open + 1, to: close, insert: "{ limit: 100 }" });
      changed.push(line);
      continue;
    }
    const argStart = open + 1 + (inner.length - inner.trimStart().length);
    // 文字列の .search(正規表現・文字列)は別の物
    if (source[argStart] === "/" || source[argStart] === '"' || source[argStart] === "'" || source[argStart] === "`") continue;
    if (source[argStart] !== "{") {
      stopped.push({ line, reason: `${match[1]} の引数が object literal でない(受け流し: 型を BoundedSearchParams に、外から来る limit は resolveSearchLimit)` });
      continue;
    }
    const objClose = matchClose(source, argStart);
    const { keys, spread } = topLevelKeys(source, argStart, objClose);
    if (keys.includes("limit")) continue;
    if (spread) {
      stopped.push({ line, reason: `${match[1]} の引数に展開(...)があり limit の有無が読めない` });
      continue;
    }
    const body = source.slice(argStart + 1, objClose);
    if (body.trim() === "") {
      edits.push({ from: argStart, to: objClose + 1, insert: "{ limit: 100 }" });
    } else if (body.includes("\n")) {
      // 複数行: 最後の項目の後ろに同じ字下げで 1 行足す
      const lastLineStart = source.lastIndexOf("\n", objClose - 1);
      const closingIndent = /^[ \t]*/.exec(source.slice(lastLineStart + 1))[0];
      const firstItem = /\n([ \t]*)\S/.exec(body);
      const indent = firstItem ? firstItem[1] : `${closingIndent}  `;
      const before = source.slice(argStart + 1, lastLineStart).replace(/\s*$/, "");
      const comma = before.endsWith(",") ? "" : ",";
      edits.push({ from: argStart + 1 + before.length, to: lastLineStart, insert: `${comma}\n${indent}limit: 100,` });
    } else {
      const trimmed = body.replace(/\s*$/, "");
      const comma = trimmed.trimEnd().endsWith(",") ? "" : ",";
      edits.push({ from: argStart + 1 + trimmed.length, to: objClose, insert: `${comma} limit: 100 ` });
    }
    changed.push(line);
  }
  let text = source;
  for (const edit of edits.sort((a, b) => b.from - a.from)) text = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
  return { text, changed, stopped };
}

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--apply");
  if (unknown.length > 0) {
    console.error(`知らない引数: ${unknown.join(" ")}(使い方: node <この file> [--apply])`);
    process.exit(2);
  }
  const apply = args.includes("--apply");
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => TARGET.test(file) && !CLIENT_PATH.test(file));
  let changedCount = 0;
  let stoppedCount = 0;
  for (const file of files) {
    const path = join(process.cwd(), file);
    const source = readFileSync(path, "utf8");
    const { text, changed, stopped } = rewrite(source);
    for (const line of changed) console.log(`${apply ? "足した" : "足す"}: ${file}:${line} limit: 100`);
    for (const { line, reason } of stopped) console.log(`止めた: ${file}:${line} ${reason}`);
    changedCount += changed.length;
    stoppedCount += stopped.length;
    if (apply && text !== source) writeFileSync(path, text);
  }
  console.log(`変更 ${changedCount} か所 / 止めた ${stoppedCount} か所${apply ? "" : "(dry-run。--apply で書く)"}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
