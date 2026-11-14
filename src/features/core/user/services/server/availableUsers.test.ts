// src/features/core/user/services/server/availableUsers.test.ts
// 「利用できる利用者」の述語の SQL: 削除されていない・USER_AVAILABLE_STATUSES・デモは既定で外し includeDemo で含める
// 実行: pnpm test src/features/core/user/services/server/availableUsers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { PgDialect } from "drizzle-orm/pg-core";

import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";

import { availableUserWhere } from "./availableUsers";

const dialect = new PgDialect();

test("既定: 削除されていない・利用できる状態・デモでない", () => {
  const { sql, params } = dialect.sqlToQuery(availableUserWhere());
  assert.match(sql, /"deleted_at" is null/);
  assert.match(sql, /"status" in \(/);
  assert.match(sql, /"is_demo" = \$/);
  assert.deepEqual(params, [...USER_AVAILABLE_STATUSES, false]);
});

test("includeDemo: デモの条件を足さない", () => {
  const { sql, params } = dialect.sqlToQuery(availableUserWhere({ includeDemo: true }));
  assert.doesNotMatch(sql, /is_demo/);
  assert.deepEqual(params, [...USER_AVAILABLE_STATUSES]);
});
