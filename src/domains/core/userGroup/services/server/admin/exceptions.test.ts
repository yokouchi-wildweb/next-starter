// src/domains/core/userGroup/services/server/admin/exceptions.test.ts
// 例外の包み(元の定義 or 足す人)and not 外す人 の往復と、包みでない木を触らないこと。実行: pnpm test src/domains/core/userGroup
import { test } from "node:test";
import assert from "node:assert/strict";

import type { UserGroupDefinitionNode } from "../../../entities/schema";
import { unwrapExceptions, wrapWithExceptions } from "./exceptions";

const base: UserGroupDefinitionNode = { op: "or", children: [{ part: "role", args: { roles: ["user"] } }, { part: "status", args: { statuses: ["active"] } }] };
const ids = { includeId: "00000000-0000-4000-8000-0000000000a1", excludeId: "00000000-0000-4000-8000-0000000000b2" };

test("包んで外すと元の定義と例外のグループに戻る", () => {
  const wrapped = wrapWithExceptions(base, ids);
  assert.deepEqual(unwrapExceptions(wrapped, new Set([ids.includeId, ids.excludeId])), { base, exceptions: ids });
});

test("持ち主付きのグループを指さない同じ形の木・包みでない木はそのまま", () => {
  const wrapped = wrapWithExceptions(base, ids);
  assert.deepEqual(unwrapExceptions(wrapped, new Set([ids.includeId])), { base: wrapped, exceptions: null });
  assert.deepEqual(unwrapExceptions(base, new Set([ids.includeId, ids.excludeId])), { base, exceptions: null });
  const leaf: UserGroupDefinitionNode = { part: "role", args: { roles: ["admin"] } };
  assert.deepEqual(unwrapExceptions(leaf, new Set()), { base: leaf, exceptions: null });
});
