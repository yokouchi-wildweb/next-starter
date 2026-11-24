// src/lib/cron/expiry.test.mts
// 期限の削除の 1 本の定期処理(runExpiryRules)を偽物の表・印で回す: 規則ごとの SQL の字面(expiresAt / age / rowDays・where・束の数)、
// 印の古い順に回す(前回切れた項目が先頭)、予算で切れた項目は印を進めない、鍵が取れなければ locked、項目 0・enabled false は skipped、
// 字面の使えない項目は消す前に止める。実行: pnpm test src/lib/cron/expiry.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { expiryDeleteQuery, runExpiryRules, type ExpiryRule, type ExpiryRuleItem, type ExpiryStore } from "./expiry";

const dialect = new PgDialect();
const render = (rule: ExpiryRule, n = 1000) => {
  const q = dialect.sqlToQuery(expiryDeleteQuery(rule, n, new Date("2026-01-01T00:00:00Z")));
  return { text: q.sql, params: q.params };
};

test("SQL: 規則ごとの条件、where は AND で絞るだけ、束の数、識別子は括る", () => {
  const exp = render({ table: "paired_device_pairings", key: "id", rule: { kind: "expiresAt", column: "expires_at" } }, 500);
  assert.equal(
    exp.text,
    'WITH d AS (DELETE FROM "paired_device_pairings" WHERE "id" IN (SELECT "id" FROM "paired_device_pairings" WHERE "expires_at" < $1::timestamptz ORDER BY "expires_at" LIMIT $2 FOR UPDATE SKIP LOCKED) RETURNING 1) SELECT count(*)::int AS n FROM d',
  );
  assert.deepEqual(exp.params, ["2026-01-01T00:00:00.000Z", 500]);
  const age = render({ table: "wallet_lots", key: "id", rule: { kind: "age", column: "created_at", days: () => 30 }, where: sql`remaining = 0` });
  assert.match(age.text, /WHERE "created_at" < \$1::timestamptz - make_interval\(days => \$2\) AND \(remaining = 0\) ORDER BY "created_at"/);
  assert.deepEqual(age.params.slice(0, 2), ["2026-01-01T00:00:00.000Z", 30]);
  const row = render({ table: "audit_logs", key: "id", rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" } });
  assert.match(row.text, /WHERE "created_at" \+ \("retention_days" \* INTERVAL '1 day'\) < \$1::timestamptz ORDER BY "created_at"/);
});

function fakeStore(rows: Record<string, number>, options: { locked?: boolean } = {}) {
  const calls: string[] = [];
  const store: ExpiryStore = {
    async withTryLock(_key, fn) {
      if (options.locked) return { locked: false };
      return { locked: true, value: await fn() };
    },
    async deleteBatch(rule, batchSize) {
      calls.push(`${rule.table}:${batchSize}`);
      const n = Math.min(rows[rule.table] ?? 0, batchSize);
      rows[rule.table] = (rows[rule.table] ?? 0) - n;
      return n;
    },
  };
  return { store, calls, rows };
}

const item = (domain: string | null, name: string, plug: Partial<ExpiryRule> = {}): ExpiryRuleItem => ({
  domain,
  name,
  plug: { table: name, key: "id", rule: { kind: "expiresAt", column: "expires_at" }, ...plug },
});

function checkpoints(initial: Record<string, number> = {}) {
  const marks = new Map(Object.entries(initial).map(([k, v]) => [k, new Date(v)]));
  return {
    marks,
    checkpoint: {
      get: async (name: string, fallback: Date) => marks.get(name) ?? fallback,
      advance: async (name: string, ts: Date) => {
        if ((marks.get(name)?.getTime() ?? 0) < ts.getTime()) marks.set(name, ts);
      },
    },
  };
}

const far = () => new Date(Date.now() + 60_000);

test("印の古い順に回し、消し切った項目の印を実行の始まりへ進める。batchSize ごとに消す", async () => {
  const { store, calls } = fakeStore({ a_rows: 5, b_rows: 2 });
  const { checkpoint, marks } = checkpoints({ "expiry-prune:a/a_rows": 2000, "expiry-prune:b/b_rows": 1000 });
  const now = new Date(5000);
  const result = await runExpiryRules({
    items: [item("a", "a_rows", { batchSize: 2 }), item("b", "b_rows")],
    store,
    checkpoint,
    deadline: far(),
    now: () => now,
  });
  assert.deepEqual(calls, ["b_rows:1000", "a_rows:2", "a_rows:2", "a_rows:2"]);
  assert.deepEqual(result, { items: [{ name: "b/b_rows", deleted: 2, exhausted: true }, { name: "a/a_rows", deleted: 5, exhausted: true }], truncated: false });
  assert.equal(marks.get("expiry-prune:a/a_rows")?.getTime(), 5000);
  assert.equal(marks.get("expiry-prune:b/b_rows")?.getTime(), 5000);
});

test("締切: 切れた項目は印を進めず truncated、次の回はその項目から", async () => {
  const { store } = fakeStore({ a_rows: 10, b_rows: 3 });
  const { checkpoint, marks } = checkpoints();
  const first = await runExpiryRules({ items: [item("a", "a_rows"), item("b", "b_rows")], store, checkpoint, deadline: new Date(Date.now() - 1) });
  assert.equal(first.truncated, true);
  assert.equal(marks.size, 0);
  marks.set("expiry-prune:a/a_rows", new Date(9000));
  const { store: store2, calls } = fakeStore({ a_rows: 0, b_rows: 3 });
  await runExpiryRules({ items: [item("a", "a_rows"), item("b", "b_rows")], store: store2, checkpoint, deadline: far() });
  assert.equal(calls[0], "b_rows:1000", "印の無い(古い)項目が先");
});

test("項目 0・enabled false だけ → skipped no-items(鍵も取らない)、鍵が取れなければ locked", async () => {
  const { checkpoint } = checkpoints();
  const locked = fakeStore({}, { locked: true });
  assert.deepEqual(await runExpiryRules({ items: [], store: locked.store, checkpoint, deadline: far() }), { skipped: "no-items", items: [], truncated: false });
  assert.deepEqual(
    await runExpiryRules({ items: [item("a", "a_rows", { enabled: false })], store: locked.store, checkpoint, deadline: far() }),
    { skipped: "no-items", items: [], truncated: false },
  );
  assert.deepEqual(await runExpiryRules({ items: [item("a", "a_rows")], store: locked.store, checkpoint, deadline: far() }), { skipped: "locked", items: [], truncated: false });
});

test("字面の使えない項目(表・列の名前・batchSize・days)は消す前に止める", async () => {
  const { store, calls } = fakeStore({ a_rows: 1 });
  const { checkpoint } = checkpoints();
  const run = (plug: Partial<ExpiryRule>) => runExpiryRules({ items: [item("a", "a_rows"), item("b", "b_rows", plug)], store, checkpoint, deadline: far() });
  await assert.rejects(run({ table: 'x"; drop' }), /table/);
  await assert.rejects(run({ rule: { kind: "rowDays", column: "created_at", daysColumn: "Days" } }), /daysColumn/);
  await assert.rejects(run({ batchSize: 0 }), /batchSize/);
  await assert.rejects(run({ rule: { kind: "age", column: "created_at", days: 0 } }), /days/);
  assert.deepEqual(calls, [], "どの項目も消していない");
});
