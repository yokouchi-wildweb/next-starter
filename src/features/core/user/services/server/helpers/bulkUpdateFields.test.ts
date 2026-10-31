// src/features/core/user/services/server/helpers/bulkUpdateFields.test.ts
// 実行: pnpm test:user-bulk-update

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { assertBulkUpdateIds, parseBulkUpdateFields } from "./bulkUpdateFields";

const status = (error: unknown) => (error as { status?: number }).status;
const UUID = "6f1c1a52-5c3e-4a55-9a0b-0d7a1c2b3e4f";

describe("parseBulkUpdateFields", () => {
  test("許可された列は通る", () => {
    assert.deepEqual(parseBulkUpdateFields({ adminMemo: "memo", user_tag_ids: [UUID] }), {
      adminMemo: "memo",
      user_tag_ids: [UUID],
    });
  });

  test("空文字の管理メモは null に正規化する", () => {
    assert.deepEqual(parseBulkUpdateFields({ adminMemo: "" }), { adminMemo: null });
  });

  for (const field of ["name", "status", "role", "email", "phoneNumber", "localPassword", "newPassword", "isDemo", "avatarUrl", "deletedAt"]) {
    test(`${field} は黙って捨てず 400 にする`, () => {
      assert.throws(() => parseBulkUpdateFields({ adminMemo: "memo", [field]: "x" }), (e) => status(e) === 400);
    });
  }

  test("値の型が違えば 400", () => {
    assert.throws(() => parseBulkUpdateFields({ user_tag_ids: "x" }), (e) => status(e) === 400);
  });

  test("オブジェクト以外は 400", () => {
    for (const data of [undefined, null, "x", []]) {
      assert.throws(() => parseBulkUpdateFields(data), (e) => status(e) === 400);
    }
  });
});

describe("assertBulkUpdateIds", () => {
  test("uuid の配列は通る", () => {
    assert.doesNotThrow(() => assertBulkUpdateIds([UUID]));
  });

  test("uuid でない値は 400", () => {
    for (const ids of ["x", ["x"], undefined]) {
      assert.throws(() => assertBulkUpdateIds(ids), (e) => status(e) === 400);
    }
  });

  test("上限を超えたら 400", () => {
    assert.throws(() => assertBulkUpdateIds(Array(1001).fill(UUID)), (e) => status(e) === 400);
  });
});
