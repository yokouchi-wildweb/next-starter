// dc:compare（fork がドメインごとに generate を決める比較）の契約テスト。
// 一時の git リポ（このリポの src と生成器の写し）で base の commit → fork の変更 → 比較し、分類の各欄を確かめる。
// 実行: pnpm test:dc-compare
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { classifyFile, diffStats, summarizeDomain } from "../cli/compare/classify.mjs";
import { generateAllConfig } from "../cli/compare/trees.mjs";
import { runCompare } from "../cli/compare/run.mjs";
import { repoRoot } from "./helpers.mjs";

const cleanup = [];
after(() => cleanup.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const SILENT = { log: () => {}, warn: () => {} };

test("diffStats: 足した・消した行、かたまりの数、挿しただけのかたまり", () => {
  assert.deepEqual(diffStats("a\nb\nc", "a\nb\nc"), { added: 0, removed: 0, hunks: 0, insertOnly: 0 });
  assert.deepEqual(diffStats("a\nc", "a\nb\nc"), { added: 1, removed: 0, hunks: 1, insertOnly: 1 });
  assert.deepEqual(diffStats("a\nb\nc", "a\nx\nc"), { added: 1, removed: 1, hunks: 1, insertOnly: 0 });
  assert.deepEqual(diffStats("a\nb\nc\nd", "a\nc"), { added: 0, removed: 2, hunks: 2, insertOnly: 0 });
});

test("classifyFile: 未改変・手の変更（挿した行）・古い生成物（消した・置き換えただけ）・新しく作られる・write-once・表の書き直し", () => {
  const f = (over) => ({ path: "src/features/x/components/A.tsx", current: "a\nb", base: "a\nb", now: "a\nb", baseListed: true, nowListed: true, ...over });
  assert.equal(classifyFile(f({})).kind, "untouched");
  assert.equal(classifyFile(f({ now: "a\nb\nc" })).upstreamChanges, true);
  assert.equal(classifyFile(f({ current: "a\nmine\nb" })).kind, "hand");
  assert.equal(classifyFile(f({ current: "a" })).kind, "stale");
  assert.equal(classifyFile(f({ current: "a\nB" })).kind, "stale");
  assert.equal(classifyFile(f({ current: "a\nmine\nb", nowAction: "保持" })).kind, "keep");
  const created = classifyFile(f({ path: "src/app/admin/(protected)/xs/page.tsx", current: null }));
  assert.deepEqual([created.kind, created.entry], ["new", true]);
  assert.equal(classifyFile(f({ path: "src/features/x/entities/drizzle.ts", now: "a\nb\nc" })).tableRewrite, true);
  // base が扱わないファイルは今の出力と比べる
  assert.equal(classifyFile(f({ baseListed: false, base: null, current: "a\nb" })).kind, "untouched");
});

test("summarizeDomain: 見込み（止まる > 手の変更 > 入口・表・古い生成物 > そのまま）", () => {
  const file = (kind, extra = {}) => ({ path: "p", result: { kind, upstreamChanges: false, entry: false, tableRewrite: false, stats: { added: 1, removed: 0, hunks: 1, insertOnly: 1 }, ...extra } });
  const verdict = (files, more = {}) => summarizeDomain({ files, forkFiles: [], wrapperFiles: [], ...more }).verdict;
  assert.equal(verdict([file("untouched")]), "true にできる");
  assert.equal(verdict([file("stale")]), "確かめて true");
  assert.equal(verdict([file("new", { entry: true })]), "確かめて true");
  assert.equal(verdict([file("hand")]), "wrappers へ移すか false");
  assert.equal(verdict([file("untouched")], { nowError: "止まる" }), "直してから");
});

test("generateAllConfig: 写しの domain.json を「全部生成する」形に（generateFiles の生成器 / generate の旗の生成器、集まりの従属）", () => {
  const legacy = { legacy: true, categories: ["entities", "components"] };
  assert.deepEqual(generateAllConfig({ singular: "x", generateFiles: { entities: false } }, legacy).generateFiles, { entities: true, components: true });
  const child = { singular: "c", generateFiles: { components: false, hooks: false } };
  assert.deepEqual(generateAllConfig(child, legacy).generateFiles, child.generateFiles);
  assert.deepEqual(generateAllConfig({ singular: "x", generate: false, generateFiles: { entities: false } }, { legacy: false, categories: [] }), { singular: "x" });
});

const sh = (cwd, cmd, args) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const MEMO = {
  domainConfigVersion: "1.3",
  singular: "memo",
  plural: "memos",
  label: "メモ",
  dbEngine: "Neon",
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  fields: [{ name: "title", label: "題", fieldType: "string", formInput: "textInput", required: true }],
  tableFields: ["title"],
};

test("実地: base で生成 → fork が手を入れる → 分類。generateFiles の残る domain.json を読み、fork のリポには書かない", { timeout: 240_000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dc-compare-test-"));
  cleanup.push(root);
  fs.cpSync(path.join(repoRoot, "src"), path.join(root, "src"), { recursive: true });
  for (const dir of ["scripts/structure/domain", "scripts/structure/registry"]) fs.cpSync(path.join(repoRoot, dir), path.join(root, dir), { recursive: true });
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"), "dir");
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules\n");
  const memoDir = path.join(root, "src/features/memo");
  fs.mkdirSync(memoDir, { recursive: true });
  fs.writeFileSync(path.join(memoDir, "domain.json"), JSON.stringify(MEMO, null, 2));
  sh(root, "node", ["scripts/structure/domain/index.mjs", "--generate", "memo"]);
  sh(root, "git", ["init", "-q"]);
  sh(root, "git", ["add", "-A"]);
  sh(root, "git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base"]);
  const base = sh(root, "git", ["rev-parse", "HEAD"]).trim();

  // fork の変更: 古い区分のキー、手の変更（挿した行）、古い生成物（消した行）、fork のファイル、消した hook と管理画面の Screen
  fs.writeFileSync(path.join(memoDir, "domain.json"), JSON.stringify({ ...MEMO, generateFiles: { components: false } }, null, 2));
  const form = path.join(memoDir, "components/common/MemoForm.tsx");
  fs.writeFileSync(form, fs.readFileSync(form, "utf8").replace("\n", "\n// fork の手の変更\n"));
  const header = path.join(memoDir, "components/AdminMemoList/Header.tsx");
  fs.writeFileSync(header, fs.readFileSync(header, "utf8").split("\n").slice(1).join("\n"));
  fs.writeFileSync(path.join(memoDir, "components/MemoExtra.tsx"), "export const x = 1;\n");
  fs.rmSync(path.join(memoDir, "hooks/useMemo.ts"));
  fs.rmSync(path.join(root, "src/app/admin/(protected)/memos/_screen"), { recursive: true });
  const before = sh(root, "git", ["status", "--short"]);

  const [memo] = await runCompare(["memo", "--base", base], { repoRoot: root, io: SILENT });
  const kindOf = (rel) => memo.files.find((f) => f.path === rel)?.result.kind;
  assert.equal(kindOf("src/features/memo/components/common/MemoForm.tsx"), "hand");
  assert.equal(kindOf("src/features/memo/components/AdminMemoList/Header.tsx"), "stale");
  assert.equal(kindOf("src/features/memo/hooks/useMemo.ts"), "new");
  assert.equal(kindOf("src/features/memo/entities/schema.ts"), "untouched");
  assert.deepEqual(memo.forkFiles, ["src/features/memo/components/MemoExtra.tsx"]);
  assert.ok(memo.summary.newEntries.some((p) => p.includes("/memos/_screen/")));
  assert.equal(memo.summary.verdict, "wrappers へ移すか false");
  assert.equal(sh(root, "git", ["status", "--short"]), before);
});
