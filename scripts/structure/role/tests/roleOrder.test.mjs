// ロールの一覧の並び方(roleOrder.mjs): 設定 user の roleOrder の読み(構文木)と並びの決め方
// 実行: pnpm test scripts/structure/role/tests/roleOrder.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { orderRoles, parseRoleOrderSetting } from "../roleOrder.mjs";

test("設定の読み: roleOrder 無し = []、satisfies の object から読む、リテラルでない・文字列でない値は理由", () => {
  assert.deepEqual(parseRoleOrderSetting("export default {} satisfies UserOverride<Extra>;\n"), { order: [] });
  assert.deepEqual(parseRoleOrderSetting('export default { enableUserMemo: true, roleOrder: ["admin", "user", "editor"] } satisfies UserOverride<Extra>;\n'), { order: ["admin", "user", "editor"] });
  assert.match(parseRoleOrderSetting("const ids = [];\nexport default { roleOrder: ids };\n").problem ?? "", /roleOrder: リテラルでない値/);
  assert.match(parseRoleOrderSetting("export default { roleOrder: [1, 2] };\n").problem ?? "", /ID の文字列の配列/);
});

test("並び: 設定の並び → 今の一覧の並び → 末尾(コア先・ID 順)、重複は誤り、ロールの無い ID は飛ばす", () => {
  const isCore = (id) => ["admin", "user", "debugger"].includes(id);
  const ids = ["admin", "user", "debugger", "editor", "contributor", "zeta", "alpha"];
  // 上流の一覧の並び(admin, user, editor, debugger, contributor)を取っても設定の並びが勝つ
  const listed = ["admin", "user", "editor", "debugger", "contributor"];
  const result = orderRoles({ setting: ["admin", "user", "contributor", "editor", "nobody"], listed, ids, isCore });
  assert.deepEqual(result, { order: ["admin", "user", "contributor", "editor", "debugger", "alpha", "zeta"], problems: [], skipped: ["nobody"] });
  assert.deepEqual(orderRoles({ setting: [], listed, ids: listed, isCore }).order, listed, "設定が空 = 今の一覧のまま");
  assert.match(orderRoles({ setting: ["admin", "admin"], listed, ids, isCore }).problems[0] ?? "", /2 回以上ある ID: admin/);
});
