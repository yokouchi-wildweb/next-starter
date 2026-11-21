#!/usr/bin/env node
// .notices/20261121-153726-cc-prep.force-dynamic.mjs
// page・layout・route から `export const dynamic = "force-dynamic";` の行を消す移行(cacheComponents の準備)。fork のリポのルートで走らせる。
// 使い方: node .notices/20261121-153726-cc-prep.force-dynamic.mjs [--apply]
//   既定は dry-run(消す行の一覧と止めた一覧を出すだけ)。--apply で書く。何度走らせても同じ結果(2 回目は変更 0)
//
// 触る物: git が追う src/app/**/{page,layout,route}.{ts,tsx} の、行がまるごと `export const dynamic = "force-dynamic";`
//   (前後の空白・末尾の ; の有無・引用符の ' と " は問わない)の行。消した直後が空行で、その前も空行なら空行を 1 つ詰める
// 止める物(書かずに一覧に出す): dynamic の別の値(force-static・error・auto)・形の違う dynamic の行(let・型注釈・複数行)と、
//   dynamicParams・fetchCache・revalidate・runtime の export。どれも cacheComponents と両立しない(lint segment-config/cc-incompatible が
//   warn で出す)が、値の意味を読んでから消すか直すかを fork が決める
// 触らない物: src/app の外、preferredRegion・maxDuration・metadata
// fork の手順:
// 1. この notice の区間を /flux で取り込む
// 2. dry-run で一覧を見る(止めた物は意味を読んで手で消す・直す)
// 3. --apply → git diff で確かめてコミット(cacheComponents off では挙動は変わらない: どのページも request を読むので動的のまま)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** 対象のファイル(src/app の page・layout・route) */
export const TARGET = /^src\/app\/(?:.+\/)?(?:page|layout|route)\.tsx?$/;
/** 消す行 */
const FORCE_DYNAMIC = /^\s*export\s+const\s+dynamic\s*=\s*(["'])force-dynamic\1\s*;?\s*$/;
/** 止める行(消す行でない segment config の export) */
const OTHER_CONFIG = /^\s*export\s+(?:const|let|var)\s+(dynamic|dynamicParams|fetchCache|revalidate|runtime)\b|^\s*export\s*\{[^}]*\b(dynamic|dynamicParams|fetchCache|revalidate|runtime)\b[^}]*\}/;

/**
 * 1 つのファイルの文から force-dynamic の行を消す
 * @returns {{ text: string, removed: number[], stopped: { line: number, text: string }[] }} 行番号は 1 始まり(元の文の)
 */
export const rewrite = (text) => {
  const lines = text.split("\n");
  const out = [];
  const removed = [];
  const stopped = [];
  lines.forEach((line, i) => {
    if (line === null) return; // 前の行で詰めると決めた空行
    if (FORCE_DYNAMIC.test(line)) {
      removed.push(i + 1);
      // 消した行の前が空行で次も空行なら、空行が 2 つ続かないように次の空行を落とす目印を付ける
      if (out.length > 0 && out[out.length - 1].trim() === "" && (lines[i + 1] ?? "").trim() === "") lines[i + 1] = null;
      return;
    }
    if (OTHER_CONFIG.test(line)) stopped.push({ line: i + 1, text: line });
    out.push(line);
  });
  // 先頭に残った空行(消した行がファイルの頭だった)は 1 つ落とす
  if (removed.length && out.length > 1 && out[0].trim() === "" && removed[0] === 1) out.shift();
  return { text: out.join("\n"), removed, stopped };
};

/** 計画: ファイルごとの消す行と止めた物 */
export const plan = (root) => {
  const tracked = execFileSync("git", ["ls-files", "-z", "--", "src/app"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((f) => TARGET.test(f));
  const files = [];
  for (const path of tracked) {
    let text;
    try {
      text = readFileSync(join(root, path), "utf8");
    } catch {
      continue; // 消えた追跡中のファイル(作業中の削除)
    }
    const r = rewrite(text);
    if (r.removed.length || r.stopped.length) files.push({ path, ...r });
  }
  return { files };
};

/** 書く(消す行のあるファイルだけ) */
export const apply = (root, planned) => {
  for (const f of planned.files) if (f.removed.length) writeFileSync(join(root, f.path), f.text);
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
  let count = 0;
  for (const f of planned.files) {
    for (const line of f.removed) {
      count++;
      console.log(`${f.path}:${line}  - export const dynamic = "force-dynamic";`);
    }
    for (const s of f.stopped) console.log(`止めた ${f.path}:${s.line}(force-dynamic でない segment config、意味を読んで手で): ${s.text.trim()}`);
  }
  const stoppedCount = planned.files.reduce((n, f) => n + f.stopped.length, 0);
  console.log(`変更 ${count} 行 / 止めた ${stoppedCount} 行${args.includes("--apply") ? "" : "(dry-run: --apply で書く)"}`);
  if (args.includes("--apply")) apply(root, planned);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
