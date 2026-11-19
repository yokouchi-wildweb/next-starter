#!/usr/bin/env node
// .notices/20261119-222756-context-after-v2.functional-folder.mjs
// 部品の棚のフォルダ src/components/Fanctional(綴りの誤り)を src/components/Functional へ改名した上流に、fork のコードを合わせる移行。
// fork のリポのルートで走らせる。
// 使い方: node .notices/20261119-222756-context-after-v2.functional-folder.mjs [--apply]
//   既定は dry-run(書き換える指定と動かすファイルの一覧を出すだけ)。--apply で書く。何度走らせても同じ結果。
//
// することは 2 つ:
// 1. src・scripts のコード(.ts / .tsx / .mts / .mjs / .js / .jsx、git の管理下)の import・export・import()・mock.module などの
//    文字列の指定で、src/components/Fanctional を指すもの(@/components/Fanctional… と、相対の …/Fanctional…)を Functional に書き換える
// 2. fork が足した src/components/Fanctional の下のファイル(上流の分は取り込みで既に動いている)を src/components/Functional の同じ名へ git mv
//    行き先に同じ名のファイルがあれば動かさず止める(手で名前を変えてから走らせ直す)
// JSON・Markdown の中のパスの字面は書き換えない(一覧に出すので手で直す)。
// fork の手順: 上流のこの区切りを取り込む → dry-run → --apply → pnpm typecheck・pnpm lint(lint deprecated-imports が残りの旧パスを挙げる)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const OLD_DIR = "src/components/Fanctional";
const NEW_DIR = "src/components/Functional";
const CODE = /\.(ts|tsx|mts|mjs|js|jsx)$/;
const DOC = /\.(md|json|jsonl)$/;
const SPEC = /(["'`])([^"'`\n]*Fanctional[^"'`\n]*)\1/g;

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const tracked = (root) => git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);

/** 指定が src/components/Fanctional(とその下)を指すなら Functional に直した指定を返す。指さなければ null */
export function rewriteSpecifier(fromFile, spec) {
  let target;
  if (spec.startsWith("@/")) target = path.posix.join("src", spec.slice(2));
  else if (spec.startsWith(".")) target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  else return null;
  if (target !== OLD_DIR && !target.startsWith(`${OLD_DIR}/`)) return null;
  const at = spec.lastIndexOf("Fanctional");
  return `${spec.slice(0, at)}Functional${spec.slice(at + "Fanctional".length)}`;
}

/** 1 本のコードのファイルの中身を書き換えた結果と、書き換えた指定の一覧 */
export function rewriteSource(fromFile, text) {
  const hits = [];
  const out = text.replace(SPEC, (whole, quote, spec) => {
    const next = rewriteSpecifier(fromFile, spec);
    if (!next) return whole;
    hits.push(`${spec} -> ${next}`);
    return `${quote}${next}${quote}`;
  });
  return { text: out, hits };
}

export function plan(root) {
  const files = tracked(root);
  const rewrites = [];
  const docs = [];
  for (const file of files) {
    if (!(file.startsWith("src/") || file.startsWith("scripts/"))) continue;
    if (!existsSync(path.join(root, file))) continue;
    const text = readFileSync(path.join(root, file), "utf8");
    if (!text.includes("Fanctional")) continue;
    if (CODE.test(file)) {
      const { text: next, hits } = rewriteSource(file, text);
      if (hits.length) rewrites.push({ file, next, hits });
    } else if (DOC.test(file)) docs.push(file);
  }
  const moves = [];
  const clashes = [];
  for (const file of files.filter((f) => f.startsWith(`${OLD_DIR}/`))) {
    const to = `${NEW_DIR}/${file.slice(OLD_DIR.length + 1)}`;
    (existsSync(path.join(root, to)) ? clashes : moves).push({ from: file, to });
  }
  return { rewrites, docs, moves, clashes };
}

export function apply(root, result) {
  for (const { from, to } of result.moves) {
    mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    git(root, ["mv", from, to]);
  }
  for (const { file, next } of result.rewrites) {
    const moved = result.moves.find((m) => m.from === file);
    writeFileSync(path.join(root, moved ? moved.to : file), next);
  }
}

function main() {
  const root = process.cwd();
  const result = plan(root);
  for (const { file, hits } of result.rewrites) for (const hit of hits) console.log(`rewrite ${file}: ${hit}`);
  for (const { from, to } of result.moves) console.log(`move ${from} -> ${to}`);
  for (const { from, to } of result.clashes) console.log(`STOP ${from}: ${to} がある(名前を変えてから走らせ直す)`);
  for (const file of result.docs) console.log(`hand ${file}: Fanctional の字面(JSON・Markdown は手で直す)`);
  if (!result.rewrites.length && !result.moves.length && !result.clashes.length) console.log("変えるものなし");
  if (result.clashes.length) process.exit(1);
  if (process.argv.includes("--apply")) {
    apply(root, result);
    console.log("applied");
  } else console.log("dry-run(--apply で書く)");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
