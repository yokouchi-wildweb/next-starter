// messaging の生の sql`` に JS の Date が渡らないことの検査(CLAUDE.md raw_sql: Postgres が Date を読めず落ちる)
// - 生の SQL の組み立て関数を PgDialect で組み立て、値に Date が 1 つも無いことを確かめる
// - 時刻は ISO の文字列 + ::timestamptz で渡る
// 生の SQL を足したら、組み立て関数を db を持たないファイルに置き、下の CASES に 1 行足す
// 実行: pnpm test src/features/core/messaging/services/server/rawSqlParams.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { inboxBeforeSql } from "./inbox/cursorSql";
import { inboxReadSql, inboxSilentSql } from "./inbox/readState";
import { inboxVisibilitySql } from "./inbox/visibility";
import { expiredDeliveriesDeleteSql, expiredDispatchesSelectSql, expiredEventsDeleteSql } from "./sweep/retentionSql";

const dialect = new PgDialect();
const CUTOFF = new Date("2026-01-02T03:04:05.000Z");
const USER = "00000000-0000-4000-8000-000000000001";

const CASES: [string, () => SQL][] = [
  ["retention: 事件", () => expiredEventsDeleteSql(CUTOFF, 1000)],
  ["retention: 配達", () => expiredDeliveriesDeleteSql(CUTOFF, 1000)],
  ["retention: 回", () => expiredDispatchesSelectSql(CUTOFF, 1000)],
  ["inbox: keyset", () => inboxBeforeSql({ publishedAt: CUTOFF, id: USER })],
  ["inbox: 見える行", () => inboxVisibilitySql({ userId: USER, role: "user" })],
  ["inbox: 既読", () => inboxReadSql(USER)],
  ["inbox: 静かな行", () => inboxSilentSql()],
];

for (const [name, build] of CASES) {
  test(`生の SQL に Date を渡さない: ${name}`, () => {
    const { params } = dialect.sqlToQuery(build());
    const dates = params.filter((value) => value instanceof Date);
    assert.equal(dates.length, 0, `Date の値が ${dates.length} 個ある(.toISOString() で渡す)`);
  });
}

test("時刻は ISO の文字列 + ::timestamptz で渡る", () => {
  for (const build of [expiredEventsDeleteSql, expiredDeliveriesDeleteSql, expiredDispatchesSelectSql]) {
    const query = dialect.sqlToQuery(build(CUTOFF, 1000));
    assert.ok(query.params.includes(CUTOFF.toISOString()));
    assert.match(query.sql, /created_at < \$1::timestamptz/);
  }
  const keyset = dialect.sqlToQuery(inboxBeforeSql({ publishedAt: CUTOFF, id: USER }));
  assert.deepEqual(keyset.params, [CUTOFF.toISOString(), USER]);
});
