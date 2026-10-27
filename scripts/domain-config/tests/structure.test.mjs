// 生成器の構造の検査: 1 ファイルの行数の上限と、層ごとに許す import。
// 生成器は細部にバグが生まれやすいので、ファイルを肥大化させず、副作用（fs・プロンプト・process.exit）の置き場を固定する。
//   spec/ domain/（workspace 以外） checks/ render/ text/ → fs / child_process / inquirer / process.exit を使わない（純粋に文字列を作る）
//   fs を触る = domain/workspace.mjs（読む）、pipeline/apply.mjs・pipeline/remove/（書く）、cli/（domain.json の書き出し・削除の対話）
//   inquirer = cli/ と questions/ だけ | process.exit = cli/ だけ | render/ は pipeline/ と cli/ を import しない
// 実行: pnpm test:dc-structure
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_LINES = 200;
const MAX_TEST_LINES = 320;

function listMjs(dir, out = []) {
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, dirent.name);
    if (dirent.isDirectory()) listMjs(abs, out);
    else if (dirent.name.endsWith(".mjs")) out.push(abs);
  }
  return out;
}

const files = listMjs(root).map((abs) => ({ abs, rel: path.relative(root, abs).split(path.sep).join("/"), text: fs.readFileSync(abs, "utf8") }));
const isTest = (rel) => rel.startsWith("tests/");
const inLayer = (rel, ...layers) => layers.some((layer) => rel.startsWith(`${layer}/`));

const importsOf = (text) => [...text.matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]);
const usesModule = (text, name) => importsOf(text).some((source) => source === name || source === `node:${name}`);

test(`1 ファイルは ${MAX_LINES} 行以内（テストは ${MAX_TEST_LINES} 行）`, () => {
  const over = files
    .map(({ rel, text }) => ({ rel, lines: text.split("\n").length, max: isTest(rel) ? MAX_TEST_LINES : MAX_LINES }))
    .filter(({ lines, max }) => lines > max);
  assert.deepEqual(over, [], "分割してください");
});

test("純粋な層（spec / domain / checks / render / text）は fs・child_process・inquirer・process.exit を使わない", () => {
  const pure = files.filter(({ rel }) => inLayer(rel, "spec", "domain", "checks", "render", "text") && rel !== "domain/workspace.mjs");
  const violations = [];
  for (const { rel, text } of pure) {
    for (const name of ["fs", "fs/promises", "child_process"]) if (usesModule(text, name)) violations.push(`${rel}: ${name}`);
    if (usesModule(text, "inquirer")) violations.push(`${rel}: inquirer`);
    if (/process\.exit\(/.test(text)) violations.push(`${rel}: process.exit`);
  }
  assert.deepEqual(violations, []);
});

test("fs を触るのは workspace・apply・remove・cli だけ", () => {
  const allowed = (rel) => rel === "domain/workspace.mjs" || rel === "pipeline/apply.mjs" || inLayer(rel, "pipeline/remove", "cli") || isTest(rel);
  const violations = files.filter(({ rel, text }) => !allowed(rel) && usesModule(text, "fs")).map(({ rel }) => rel);
  assert.deepEqual(violations, []);
});

test("inquirer は cli と questions だけ、process.exit は cli だけ", () => {
  const inquirerViolations = files
    .filter(({ rel, text }) => !inLayer(rel, "cli", "questions") && !isTest(rel) && usesModule(text, "inquirer"))
    .map(({ rel }) => rel);
  const exitViolations = files.filter(({ rel, text }) => !inLayer(rel, "cli") && !isTest(rel) && /process\.exit\(/.test(text)).map(({ rel }) => rel);
  assert.deepEqual(inquirerViolations, []);
  assert.deepEqual(exitViolations, []);
});

test("render は pipeline / cli を import しない（依存は cli → pipeline → render → domain → spec の一方向）", () => {
  const violations = [];
  for (const { rel, abs, text } of files) {
    if (!inLayer(rel, "render", "domain", "spec", "checks", "text")) continue;
    for (const source of importsOf(text)) {
      if (!source.startsWith(".")) continue;
      const target = path.relative(root, path.resolve(path.dirname(abs), source)).split(path.sep).join("/");
      if (inLayer(target, "pipeline", "cli", "questions")) violations.push(`${rel} → ${target}`);
      if (inLayer(rel, "spec") && !inLayer(target, "spec") && !target.startsWith("../")) violations.push(`${rel} → ${target}`);
    }
  }
  assert.deepEqual(violations, []);
});
