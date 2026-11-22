// 上書きの対象の点(overrides の点)と、その鍵の読み手 overrideKeysOf のテスト。宣言の形の他の検査は scripts/structure/extensions/extensions.test.mjs
// 実行: pnpm test src/lib/districtMap/declarations.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { collectPoints, overrideKeysOf } from "./declarationFiles.mjs";
import { isListPoint } from "./declarations.mjs";

test("実リポの上書きの対象の点 5 つ: 鍵の集合は宣言へ寄せる前と同じ(fork の今の重ねが同じに通る)。core ロールに enabled・プロフィールに fields は無い", () => {
  assert.deepEqual(overrideKeysOf("src/domains/core/user/extensionPoints.ts", "coreRoleDefinitions"), ["label", "hasProfile"]);
  assert.deepEqual(overrideKeysOf("src/domains/core/user/extensionPoints.ts", "roleDefinitions"), ["label", "hasProfile", "enabled"]);
  assert.deepEqual(overrideKeysOf("src/domains/core/userProfile/extensionPoints.ts", "profileDefinitions"), ["tags", "searchFields", "audit"]);
  assert.deepEqual(overrideKeysOf("src/lib/cron/extensionPoints.ts", "cronTasks"), ["schedule", "disabled"]);
  assert.deepEqual(overrideKeysOf("src/lib/domain/extensionPoints.ts", "domainEntries"), ["access"]);
});

test("実リポ: overrides の点は受け口の一覧に入らない(writer の点と同じく isListPoint が false)", () => {
  const { points, problems } = collectPoints(join(import.meta.dirname, "../../.."));
  assert.deepEqual(problems, []);
  const targets = points.filter((p) => p.spec.overrides !== undefined).map((p) => `${p.owner}:${p.name}`);
  assert.deepEqual(targets.sort(), [
    "src/domains/core/user:coreRoleDefinitions",
    "src/domains/core/user:roleDefinitions",
    "src/domains/core/userProfile:profileDefinitions",
    "src/lib/cron:cronTasks",
    "src/lib/domain:domainEntries",
    "src/lib/messaging:messages",
    "src/lib/messaging:recordTargets",
  ]);
  assert.ok(points.filter((p) => p.spec.overrides !== undefined).every((p) => !isListPoint(p.spec)));
  assert.ok(points.filter((p) => p.spec.writer !== undefined).every((p) => !isListPoint(p.spec)));
  assert.ok(points.some((p) => isListPoint(p.spec)));
});

test("overrideKeysOf: 宣言が無い・点が無い・overrides の点でない・形の誤りは throw", () => {
  const root = mkdtempSync(join(tmpdir(), "declarations-"));
  try {
    /** @param {string} path @param {string} text */
    const put = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    put("src/lib/a/extensionPoints.ts", 'export const extensionPoints = {\n  tasks: { overrides: "src/a/*.ts", export: "override", side: "server", overrideOf: ["x"] },\n  roles: { writer: "role:generate", side: "shared" },\n};\n');
    put("src/lib/b/extensionPoints.ts", 'export const extensionPoints = {\n  tasks: { overrides: "src/a/*.ts", export: "override", side: "server" },\n};\n');
    assert.deepEqual(overrideKeysOf("src/lib/a/extensionPoints.ts", "tasks", root), ["x"]);
    assert.throws(() => overrideKeysOf("src/lib/none/extensionPoints.ts", "tasks", root), /が無い/);
    assert.throws(() => overrideKeysOf("src/lib/a/extensionPoints.ts", "gone", root), /点 gone が無い/);
    assert.throws(() => overrideKeysOf("src/lib/a/extensionPoints.ts", "roles", root), /overrides の点でない/);
    assert.throws(() => overrideKeysOf("src/lib/b/extensionPoints.ts", "tasks", root), /overrideOf/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
