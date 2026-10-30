// core のドメイン（src/features/core/<domain>/domain.json）を business と同じに扱う契約テスト（D41）と、
// 手で管理（generate: false）のドメインはどんな実行でも生成器を通さない契約（人の決定。検査もしない・何も書かない）。
// 実行: pnpm test:dc-core-domain
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDomainContext } from "../domain/context.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { configTargets, loadDomainForGenerate, narrowTargets } from "../pipeline/generate.mjs";
import { ALL_GENERATE_OPTIONS } from "../spec/categories.mjs";
import { planDomain } from "../pipeline/plan.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));
const capture = () => {
  const lines = { log: [], warn: [] };
  return { lines, io: { log: (m) => lines.log.push(m), warn: (m) => lines.warn.push(m) } };
};
const MEMO = { singular: "memo", plural: "memos", label: "メモ", dbEngine: "Neon", idType: "uuid", useCreatedAt: true, useUpdatedAt: true, fields: [{ name: "title", label: "題", fieldType: "string", formInput: "textInput" }] };
const ALIAS = { compilerOptions: { paths: { "@/features/memo/*": ["./src/features/core/memo/*"] } } };

function project(configs, { alias = true } = {}) {
  const root = makeProject({ configs, cleanup });
  if (alias) fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify(ALIAS));
  return root;
}

test("所在: core の domain.json は core のフォルダ、一覧は business と core の両方、両方にあれば止める", () => {
  const root = project({ alpha: { singular: "alpha" }, "core/memo": MEMO });
  const workspace = createWorkspace(root);
  assert.deepEqual(workspace.listDomains(), ["alpha", "memo"]);
  const ctx = createDomainContext(workspace, "memo");
  assert.equal(ctx.kind, "core");
  assert.equal(ctx.rel, "src/features/core/memo");
  assert.equal(ctx.configPath, path.join(root, "src/features/core/memo/domain.json"));
  assert.equal(createDomainContext(workspace, "alpha").kind, "business");

  fs.mkdirSync(path.join(root, "src/features/memo"));
  fs.writeFileSync(path.join(root, "src/features/memo/domain.json"), JSON.stringify(MEMO));
  assert.throws(() => workspace.listDomains(), /両方にあります/);
});

test("生成物: core のフォルダに書き、頭のコメントは src/features/core/<d>、src/registry には書かない（domainEntry.ts は書く）", () => {
  const root = project({ "core/memo": MEMO });
  const workspace = createWorkspace(root);
  const { lines, io } = capture();
  const ctx = loadDomainForGenerate(workspace, "memo", io);
  const gen = configTargets(ctx, { ownerOf: new Map() }, ["entities", "registry"], io);
  const outputs = planDomain(ctx, workspace, gen);
  const paths = outputs.map((o) => path.relative(root, o.path));
  assert.ok(paths.length > 0);
  assert.ok(paths.every((p) => p.startsWith("src/features/core/memo/")), paths.join(", "));
  assert.ok(paths.includes("src/features/core/memo/services/server/domainEntry.ts"));
  const drizzle = outputs.find((o) => o.path.endsWith("entities/drizzle.ts"));
  assert.match(drizzle.content, /^\/\/ src\/features\/core\/memo\/entities\/drizzle\.ts/);
  assert.match(outputs.find((o) => o.path.endsWith("domainEntry.ts")).content, /^\/\/ src\/features\/core\/memo\/services\/server\/domainEntry\.ts/);
});

test("core: tsconfig.json に @/features/<d>/* の別名が無ければ生成前に止める（手で管理なら検査しない）", () => {
  const root = project({ "core/memo": MEMO }, { alias: false });
  const workspace = createWorkspace(root);
  assert.throws(() => loadDomainForGenerate(workspace, "memo", capture().io), /tsconfig\.json の compilerOptions\.paths/);
  fs.writeFileSync(path.join(root, "src/features/core/memo/domain.json"), JSON.stringify({ ...MEMO, generate: false }));
  const { lines, io } = capture();
  assert.doesNotThrow(() => loadDomainForGenerate(workspace, "memo", io));
  assert.deepEqual(lines.warn, []);
});

test("手で管理（generate: false）は生成器を通さない: 検査も警告もせず、--only・全カテゴリ（-i）でも何も書かない。generate: true は今どおり止める", () => {
  const broken = { ...MEMO, defaultOrderBy: [["missing_column", "asc"]] };
  const root = project({ memo: { ...broken, generate: false }, other: { ...broken, singular: "other" } });
  const workspace = createWorkspace(root);
  const { lines, io } = capture();
  const ctx = loadDomainForGenerate(workspace, "memo", io);
  assert.deepEqual(lines.warn, []);
  const none = (gen) => Object.values(gen).every((on) => on === false);
  assert.ok(none(configTargets(ctx, { ownerOf: new Map() }, ["entities", "registry"], io)));
  assert.ok(none(narrowTargets(ctx, ALL_GENERATE_OPTIONS, null, io)));
  assert.deepEqual(planDomain(ctx, workspace, ALL_GENERATE_OPTIONS), []);
  assert.ok(lines.log.some((m) => m.includes("generate: false（手で管理）のため何も書きません")));
  assert.throws(() => loadDomainForGenerate(workspace, "other", capture().io), /missing_column/);
});
