// src/features/core/userGroup/criteria/criteria.test.ts
// 上流の条件の部品 6 つ: 鍵・cheap・欄・引数の zod(通る / 止まる)・SQL の形(Date は引数で渡す)
// 実行: pnpm test src/features/core/userGroup
import { test } from "node:test";
import assert from "node:assert/strict";

import { PgDialect } from "drizzle-orm/pg-core";

import { criteria } from "../extensions/criteria";

const dialect = new PgDialect();
const NOW = new Date("2026-11-14T00:00:00.000Z");
const TAG = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const query = (key: string, args: unknown) => {
  const criterion = criteria[key]!;
  return dialect.sqlToQuery(criterion.where(criterion.args.parse(args), { now: NOW }));
};

test("5 つの部品が一覧にあり、購入金額の合計だけ heavy で、どれも欄がある", () => {
  assert.deepEqual(Object.keys(criteria).sort(), ["hasTag", "inStaticGroup", "lastLoginPeriod", "purchaseTotal", "signupPeriod"]);
  for (const criterion of Object.values(criteria)) {
    assert.equal(criterion.weight, criterion.key === "purchaseTotal" ? "heavy" : "cheap", criterion.key);
    assert.ok(criterion.fields.length > 0, criterion.key);
  }
});

test("登録の時期: from / to / 直近の日数(Date は引数)、どれも無い・from > to は止まる", () => {
  const { sql, params } = query("signupPeriod", { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z", withinDays: 30 });
  assert.match(sql, /"created_at" >= \$1 and "users"\."created_at" <= \$2 and "users"\."created_at" >= \$3/);
  assert.deepEqual(params.map(String), [
    new Date("2026-01-01T00:00:00Z").toISOString(),
    new Date("2026-02-01T00:00:00Z").toISOString(),
    new Date(NOW.getTime() - 30 * 86_400_000).toISOString(),
  ]);
  assert.equal(criteria.signupPeriod!.args.safeParse({}).success, false);
  assert.equal(criteria.signupPeriod!.args.safeParse({ from: "2026-02-01T00:00:00Z", to: "2026-01-01T00:00:00Z" }).success, false);
});

test("最後のログイン: N 日ログインしていない = null(一度も無い)か N 日より前", () => {
  const { sql, params } = query("lastLoginPeriod", { notWithinDays: 90 });
  assert.match(sql, /\("users"\."last_authenticated_at" is null or "users"\."last_authenticated_at" < \$1\)/);
  assert.deepEqual(params.map(String), [new Date(NOW.getTime() - 90 * 86_400_000).toISOString()]);
});

test("タグ: any = EXISTS、all = 選んだタグの数だけ持つ。静的グループの一員 = EXISTS", () => {
  assert.match(query("hasTag", { tagIds: [TAG] }).sql, /^exists \(select 1 from "user_to_user_tag" where/);
  const all = query("hasTag", { tagIds: [TAG, TAG], match: "all" });
  assert.match(all.sql, /\) = \$2$/);
  assert.deepEqual(all.params, [TAG, 1], "重なりは除いて数える");
  assert.match(query("inStaticGroup", { groupId: GROUP }).sql, /^exists \(select 1 from "user_group_members" where/);
  assert.equal(criteria.inStaticGroup!.args.safeParse({ groupId: "x" }).success, false);
});
