// 実行: pnpm test:fork-ownership
import assert from "node:assert/strict";
import { test } from "node:test";

import { overrideTargetUnit, placeUnitOf, receptacleDirsOfDeclaration, unitIndex, unitName, unitPlaces } from "./unitNames.mjs";

test("unitName: 最後の拡張子と末尾の /index を除き、.replace / .override は残す", () => {
  assert.equal(unitName("src/wiring/foo.ts"), "src/wiring/foo");
  assert.equal(unitName("src/wiring/foo.tsx"), "src/wiring/foo");
  assert.equal(unitName("src/wiring/foo/index.ts"), "src/wiring/foo");
  assert.equal(unitName("src/app/x/_layout/UserLayout.replace.tsx"), "src/app/x/_layout/UserLayout.replace");
  assert.equal(unitName("src/x/a.override.ts"), "src/x/a.override");
  assert.equal(unitName("roles/user.role.json"), "roles/user.role");
  assert.equal(unitName("scripts/README"), "scripts/README");
});

test("unitPlaces / placeUnitOf: 受け口・wiring・scripts は直下の項目だけ、route の隣はその下全部、それ以外は対象外", () => {
  const files = ["src/features/core/user/extensionPoints.ts", "src/proxies/extensionPoints.ts"];
  const texts = {
    "src/features/core/user/extensionPoints.ts": 'export const extensionPoints = {\n  // dir: "commented"\n  a: { dir: "cleanup", export: "h" },\n};\n',
    "src/proxies/extensionPoints.ts": 'export const extensionPoints = { h: { dir: "." }, r: { dir: "featureGateRules" } };\n',
  };
  const places = unitPlaces(files, (p) => texts[p] ?? null);
  assert.ok(places.direct.has("src/features/core/user/cleanup"));
  assert.ok(places.direct.has("src/proxies"));
  assert.ok(places.direct.has("src/proxies/featureGateRules"));
  assert.ok(!places.direct.has("src/features/core/user/commented"));
  assert.equal(placeUnitOf("src/features/core/user/cleanup/foo.tsx", places), "src/features/core/user/cleanup/foo");
  assert.equal(placeUnitOf("src/features/core/user/cleanup/foo/index.ts", places), "src/features/core/user/cleanup/foo");
  assert.equal(placeUnitOf("src/features/core/user/cleanup/foo/part.ts", places), null, "項目のフォルダの中の部品は見ない");
  assert.equal(placeUnitOf("src/wiring/x.ts", places), "src/wiring/x");
  assert.equal(placeUnitOf("scripts/tasks/a-b.ts", places), "scripts/tasks/a-b");
  assert.equal(placeUnitOf("scripts/proxies/alwaysOnExceptions/x.mjs", places), "scripts/proxies/alwaysOnExceptions/x");
  assert.equal(placeUnitOf("scripts/foo.mjs", places), "scripts/foo");
  assert.equal(placeUnitOf("scripts/extensions/foo.mjs", places), null);
  assert.equal(placeUnitOf("src/app/(user)/_layout/Header/Nav.tsx", places), "src/app/(user)/_layout/Header/Nav");
  assert.equal(placeUnitOf("src/app/(user)/w/_components/X.tsx", places), "src/app/(user)/w/_components/X");
  assert.equal(placeUnitOf("src/components/Foo.tsx", places), null);
  assert.equal(placeUnitOf("src/lib/x/index.ts", places), null);
});

test("receptacleDirsOfDeclaration・overrideTargetUnit・unitIndex", () => {
  assert.deepEqual(receptacleDirsOfDeclaration('{ a: { dir: "x/y" }, b: { dir: \'z\' } }'), ["x/y", "z"]);
  assert.equal(overrideTargetUnit("src/features/core/setting/fields/a.override.ts"), "src/features/core/setting/fields/a");
  assert.equal(overrideTargetUnit("src/features/core/user/roles/coreRoles/user.role.override.ts"), "src/features/core/user/roles/coreRoles/user.role");
  assert.equal(overrideTargetUnit("src/app/api/cron/x/override.ts"), null);
  assert.equal(overrideTargetUnit("src/x/a.ts"), null);
  assert.deepEqual([...unitIndex(["a/x.ts", "a/x/index.tsx", "a/y.json"]).entries()], [["a/x", "a/x.ts"], ["a/y", "a/y.json"]]);
});
