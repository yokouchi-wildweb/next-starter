// 上書きの対象の点(overrides の点)と、その鍵の読み手 overrideKeysOf のテスト。差替点の持ち主の置き場(Tier 自身の _components/ の宣言)。
// 宣言の形の他の検査は scripts/structure/extensions/extensions.test.mjs
// 実行: pnpm test src/lib/districtMap/declarations.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { collectPoints, overrideKeysOf } from "./declarationFiles.mjs";
import { isListPoint, replacePointsOf } from "./declarations.mjs";

test("実リポの上書きの対象の点 5 つ: 鍵の集合は宣言へ寄せる前と同じ(fork の今の重ねが同じに通る)。core ロールに enabled・プロフィールに fields は無い", () => {
  assert.deepEqual(overrideKeysOf("src/domains/core/user/extensionPoints.ts", "coreRoleDefinitions"), ["label", "hasProfile"]);
  assert.deepEqual(overrideKeysOf("src/domains/core/user/extensionPoints.ts", "roleDefinitions"), ["label", "hasProfile", "enabled"]);
  assert.deepEqual(overrideKeysOf("src/domains/core/userProfile/extensionPoints.ts", "profileDefinitions"), ["tags", "searchFields", "audit"]);
  assert.deepEqual(overrideKeysOf("src/lib/cron/extensionPoints.ts", "cronTasks"), ["schedule", "disabled"]);
  // 登録の上書き(entities/<登録名>/entity.override.ts)は登録表の行の access を丸ごと差し替える鍵 apiAccess だけ
  assert.deepEqual(overrideKeysOf("src/lib/domain/extensionPoints.ts", "entities"), ["apiAccess"]);
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
    "src/lib/domain:entities",
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
    put("src/lib/a/extensionPoints.ts", 'export const extensionPoints = {\n  tasks: { change: "override", overrides: "src/a/*.ts", export: "override", side: "server", overrideOf: ["x"] },\n  roles: { change: "add", writer: "role:generate", side: "shared" },\n};\n');
    put("src/lib/b/extensionPoints.ts", 'export const extensionPoints = {\n  tasks: { change: "override", overrides: "src/a/*.ts", export: "override", side: "server" },\n};\n');
    assert.deepEqual(overrideKeysOf("src/lib/a/extensionPoints.ts", "tasks", root), ["x"]);
    assert.throws(() => overrideKeysOf("src/lib/none/extensionPoints.ts", "tasks", root), /が無い/);
    assert.throws(() => overrideKeysOf("src/lib/a/extensionPoints.ts", "gone", root), /点 gone が無い/);
    assert.throws(() => overrideKeysOf("src/lib/a/extensionPoints.ts", "roles", root), /overrides の点でない/);
    assert.throws(() => overrideKeysOf("src/lib/b/extensionPoints.ts", "tasks", root), /overrideOf/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("change: どの点も書く。欄と合わない型・無い change は止め、増設点の max・order と差替点の欄を確かめる", async () => {
  const { readDeclaration } = await import("./index.mjs");
  const read = (/** @type {string} */ body) => readDeclaration("x/extensionPoints.ts", `export const extensionPoints = { p: ${body} };`).problems;
  const T = 'type: { from: "@/x", name: "T" }';
  assert.deepEqual(read(`{ change: "add", dir: "p", export: "p", ${T}, side: "server", max: 1, order: "declared" }`), []);
  assert.match(read(`{ dir: "p", export: "p", ${T}, side: "server" }`)[0], /change が無い.*欄から読むと add/);
  assert.match(read(`{ change: "override", dir: "p", export: "p", ${T}, side: "server" }`)[0], /change override が欄と合わない.*add/);
  assert.match(read(`{ change: "add", dir: "p", export: "p", ${T}, side: "server", max: 0 }`)[0], /max は 1 以上の整数/);
  assert.match(read(`{ change: "add", dir: "p", export: "p", ${T}, side: "server", order: "x" }`)[0], /order は file \| declared/);
  assert.deepEqual(read(`{ change: "replace", default: "src/a/b.default.ts", ${T}, side: "server" }`), []);
  assert.ok(read(`{ change: "replace", default: "src/a/b.default.ts", side: "server" }`).some((p) => p.includes("type は")));
  assert.ok(read(`{ change: "replace", default: "src/a/b.default.ts", ${T}, side: "server", dir: "x" }`).some((p) => p.includes("差替点に dir は書けない")));
  assert.deepEqual(read('{ change: "counterpart", placement: "src/app/icon.png", kind: "edit" }'), []);
});

test("差替点: Tier が上流のルートの _components/ に足した既定は、その _components/extensionPoints.ts の宣言で通る(持ち主 = そのフォルダ)。外の既定は止める", () => {
  const T = { from: "@/app/(user)/_components/points", name: "BrandProps" };
  const own = { owner: "src/app/(user)/_components", name: "brand", declaredIn: "src/app/(user)/_components/extensionPoints.ts" };
  const inside = replacePointsOf([{ ...own, spec: { change: "replace", default: "src/app/(user)/_components/Header/Brand.default.tsx", type: T, side: "client" } }]);
  assert.deepEqual(inside.problems, []);
  assert.deepEqual(inside.replaces.map((r) => [r.point, r.stem]), [["brand", "src/app/(user)/_components/Header/Brand"]]);
  const outside = replacePointsOf([{ ...own, spec: { change: "replace", default: "src/app/(user)/_layout/Brand.default.tsx", type: T, side: "client" } }]);
  assert.match(outside.problems.join("\n"), /宣言した地区\(src\/app\/\(user\)\/_components\)の外/);
});
