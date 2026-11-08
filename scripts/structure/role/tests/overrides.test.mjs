// ロール・プロフィールの上書き(<JSON の名前>.override.ts)の読み手のテスト。書いてよい鍵は宣言(user / userProfile の extensionPoints.ts)から読む
// 実行: pnpm test scripts/structure/role/tests/overrides.test.mjs
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProfileOverride, readRoleOverride } from "../overrides.mjs";

let dir;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "role-overrides-"));
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const put = (name, text) => fs.writeFileSync(path.join(dir, name), text);

test("fork の今の形(oripa-do の coreRoles/user.role.override.ts)が通る", () => {
  put("user.role.override.ts", 'import type { CoreRoleOverride } from "../types";\n\nexport const override: CoreRoleOverride = { hasProfile: true };\n');
  assert.deepEqual(readRoleOverride({ dir, fileName: "user.role.json", isCore: true }), { override: { hasProfile: true }, problems: [] });
});

test("鍵は宣言から: core ロールの enabled は書けず、足したロールは書ける。プロフィールの fields は書けない。どれも書ける鍵を出す", () => {
  put("user.role.override.ts", 'import type { CoreRoleOverride } from "../types";\n\nexport const override: CoreRoleOverride = { enabled: false };\n');
  const core = readRoleOverride({ dir, fileName: "user.role.json", isCore: true });
  assert.match(core.problems.join("\n"), /知らないキー enabled（書けるのは label \/ hasProfile）/);
  assert.deepEqual(readRoleOverride({ dir, fileName: "user.role.json", isCore: false }), { override: { enabled: false }, problems: [] });
  put("user.profile.override.ts", 'import type { ProfileOverride } from "../types";\n\nexport const override: ProfileOverride = { fields: [] };\n');
  assert.match(readProfileOverride(dir, "user.profile.json").problems.join("\n"), /知らないキー fields（書けるのは tags \/ searchFields \/ audit）/);
});

test("値の検査は読み手に残る(宣言の鍵でも型の違う値は止める)", () => {
  put("user.role.override.ts", 'export const override = { hasProfile: "yes" };\n');
  assert.match(readRoleOverride({ dir, fileName: "user.role.json", isCore: true }).problems.join("\n"), /hasProfile は true か false/);
  put("user.profile.override.ts", 'export const override = { searchFields: "nick" };\n');
  assert.match(readProfileOverride(dir, "user.profile.json").problems.join("\n"), /searchFields は 文字列の配列/);
});
