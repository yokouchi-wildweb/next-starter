// src/features/core/userProfile/utils/createProfileBase.test.mts
// createProfileBase が audit を createCrudService に渡し、updateByUserId が base.update を通ることのテスト。
// 実行: pnpm test src/features/core/userProfile/utils/createProfileBase.test.mts

import assert from "node:assert/strict";
import { mock, test } from "node:test";

let row: Record<string, unknown> | undefined;
let crudOptions: Record<string, unknown> | undefined;
const updates: unknown[][] = [];

mock.module("@/lib/drizzle", {
  namedExports: { db: { select: () => ({ from: () => ({ where: async () => (row ? [row] : []) }) }) } },
});
mock.module("@/lib/crud/drizzle", {
  namedExports: {
    createCrudService: (_table: unknown, options: Record<string, unknown>) => {
      crudOptions = options;
      return {
        update: async (...args: unknown[]) => {
          updates.push(args);
          return { id: args[0], ...(args[1] as object) };
        },
      };
    },
  },
});

const { createProfileBase } = await import("./createProfileBase");
const table = { userId: "user_id" };

test("audit を createCrudService に渡す（無ければ undefined）", () => {
  const recorder = {} as never;
  createProfileBase(table, { audit: { enabled: true, targetType: "userProfile", actionPrefix: "user_profile", recorder } });
  assert.equal((crudOptions?.audit as { targetType: string }).targetType, "userProfile");
  createProfileBase(table);
  assert.equal(crudOptions?.audit, undefined);
});

test("updateByUserId: id を解決して base.update を通す。userId が無ければ null で更新しない", async () => {
  const base = createProfileBase(table);
  row = undefined;
  assert.equal(await base.updateByUserId("u1", { city: "a" }), null);
  assert.equal(updates.length, 0);
  row = { id: "p1", userId: "u1" };
  assert.deepEqual(await base.updateByUserId("u1", { city: "a" }), { id: "p1", city: "a" });
  assert.deepEqual(updates, [["p1", { city: "a" }]]);
});
