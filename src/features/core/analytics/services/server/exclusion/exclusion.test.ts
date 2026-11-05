// src/features/core/analytics/services/server/exclusion/exclusion.test.ts
//
// 分析の除外条件の口(buildExclusionConditions / buildUserFilterConditions の scope)の検査(DB なし)。
// - 項目 0(上流): scope を渡しても条件は増えない(結果は今と同じ)
// - flow の scope は flow だけ、stock の scope は stock だけを足す。enabled false・includeExcluded は足さない
// - 項目に source・rowId・userId がそのまま渡る
// 実行: pnpm test:analytics-exclusion
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";

import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { AnalyticsExclusionProvider } from "./types";

let userFilter: typeof import("../utils/userFilter");
let WalletHistoryTable: typeof import("@/features/core/walletHistory/entities/drizzle").WalletHistoryTable;
before(async () => {
  userFilter = await import("../utils/userFilter");
  ({ WalletHistoryTable } = await import("@/features/core/walletHistory/entities/drizzle"));
});

const dialect = new PgDialect();
const text = (conditions: SQL[]) => conditions.map((c) => dialect.sqlToQuery(c).sql);

const seen: unknown[] = [];
const providers = (enabled = true): Record<string, AnalyticsExclusionProvider> => ({
  rows: {
    key: "rows",
    enabled: () => enabled,
    flow: (ctx) => {
      seen.push(ctx);
      return ctx.source === "wallet_histories" ? sql`NOT EXISTS (SELECT 1 FROM excluded_rows e WHERE e.row_id = ${ctx.rowId})` : undefined;
    },
  },
  people: {
    key: "people",
    enabled: () => enabled,
    stock: (ctx) => sql`${ctx.userId} NOT IN (SELECT user_id FROM excluded_people)`,
  },
});

test("項目 0 の上流: scope を渡しても条件は増えない", () => {
  const t = WalletHistoryTable;
  const base = userFilter.buildUserFilterConditions(t.user_id, {});
  const flow = userFilter.buildUserFilterConditions(t.user_id, {}, { kind: "flow", source: "wallet_histories", rowId: t.id });
  const stock = userFilter.buildUserFilterConditions(t.user_id, {}, { kind: "stock" });
  assert.equal(base.length, 0);
  assert.equal(flow.length, 0);
  assert.equal(stock.length, 0);
});

test("flow は flow の項目だけ、stock は stock の項目だけを足す", () => {
  const t = WalletHistoryTable;
  seen.length = 0;
  const flow = userFilter.buildExclusionConditions(t.user_id, {}, { kind: "flow", source: "wallet_histories", rowId: t.id }, providers());
  assert.equal(flow.length, 1);
  assert.match(text(flow)[0], /NOT EXISTS \(SELECT 1 FROM excluded_rows e WHERE e\.row_id = "wallet_histories"\."id"\)/);
  assert.deepEqual(seen, [{ source: "wallet_histories", rowId: t.id, userId: t.user_id }], "source・rowId・userId がそのまま渡る");

  const stock = userFilter.buildExclusionConditions(t.user_id, {}, { kind: "stock" }, providers());
  assert.equal(stock.length, 1);
  assert.match(text(stock)[0], /"wallet_histories"\."user_id" NOT IN \(SELECT user_id FROM excluded_people\)/);
});

test("扱わない source(undefined)・enabled false・includeExcluded は足さない", () => {
  const t = WalletHistoryTable;
  assert.equal(
    userFilter.buildExclusionConditions(t.user_id, {}, { kind: "flow", source: "purchase_requests", rowId: t.id }, providers()).length,
    0,
  );
  assert.equal(userFilter.buildExclusionConditions(t.user_id, {}, { kind: "stock" }, providers(false)).length, 0);
  assert.equal(
    userFilter.buildExclusionConditions(t.user_id, { includeExcluded: true }, { kind: "stock" }, providers()).length,
    0,
  );
});

test("parseUserFilterParams は includeExcluded=true だけを拾う", () => {
  assert.deepEqual(userFilter.parseUserFilterParams(new URLSearchParams("includeExcluded=true")), { includeExcluded: true });
  assert.deepEqual(userFilter.parseUserFilterParams(new URLSearchParams("includeExcluded=1")), {});
});
