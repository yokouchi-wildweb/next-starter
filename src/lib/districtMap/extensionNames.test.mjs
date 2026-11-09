// 拡張の名前の決まり(extensionNames.mjs)の検査。実行: pnpm test src/lib/districtMap/extensionNames.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { isClaimedDefault, isOverridePath, overrideGlobOf, overridePathOfTarget, switchSetOf, targetOfOverride } from "./extensionNames.mjs";

test("1 行スイッチの組: 既定・素の名前・置き換えのどれからも同じ組", () => {
  for (const path of ["src/a/onThing.default.ts", "src/a/onThing.ts", "src/a/onThing.replace.tsx"]) {
    const set = switchSetOf(path);
    assert.equal(set.name, "onThing");
    assert.deepEqual(set.defaults, ["src/a/onThing.default.ts", "src/a/onThing.default.tsx"]);
    assert.deepEqual(set.switches, ["src/a/onThing.ts", "src/a/onThing.tsx"]);
    assert.deepEqual(set.replaces, ["src/a/onThing.replace.ts", "src/a/onThing.replace.tsx"]);
  }
  assert.equal(switchSetOf("src/a/onThing.default.ts").role, "default");
  assert.equal(switchSetOf("src/a/onThing.ts").role, "switch");
  assert.equal(switchSetOf("src/a/user.role.json"), null);
  assert.equal(switchSetOf("src/app/(user)/frame.default.ts"), null, "枠の仕組みが名乗った形はスイッチでない");
});

test("名乗った .default: 枠の宣言の frame.default.ts は src/app の下だけ", () => {
  assert.equal(isClaimedDefault("src/app/(user)/frame.default.ts"), true);
  assert.equal(isClaimedDefault("src/features/core/x/frame.default.ts"), false);
});

test("上書きの名前: 最後の拡張子を .override.ts に、逆は対象の glob の拡張子", () => {
  assert.equal(overrideGlobOf("src/app/api/cron/*/task.ts"), "src/app/api/cron/*/task.override.ts");
  assert.equal(overridePathOfTarget("src/f/roles/a.role.json"), "src/f/roles/a.role.override.ts");
  assert.equal(targetOfOverride("src/f/roles/a.role.override.ts", "src/f/roles/*.role.json"), "src/f/roles/a.role.json");
  assert.equal(targetOfOverride("src/app/api/cron/x/task.override.ts", "src/app/api/cron/*/task.ts"), "src/app/api/cron/x/task.ts");
});

test("上書きのファイルか: 素の override.ts と src/app の frame.override.ts(枠の宣言)は違う", () => {
  assert.equal(isOverridePath("src/f/roles/a.role.override.ts"), true);
  assert.equal(isOverridePath("src/app/api/cron/x/override.ts"), false);
  assert.equal(isOverridePath("src/app/(user)/frame.override.ts"), false);
  assert.equal(isOverridePath("src/features/x/frame.override.ts"), true);
});
