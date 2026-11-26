// src/lib/cron/expiry.test.mts
// 期限の削除の 1 本の定期処理(runExpiryRules)を偽物の表・印で回す: 規則ごとの SQL の字面(expiresAt / age / rowDays・where・束の数)、
// 印の古い順に回す(前回切れた項目が先頭)、予算で切れた項目は印を進めない、鍵が取れなければ locked、項目 0・enabled false は skipped、
// 字面の使えない項目は消す前に止める。消し方 remove の項目: 鍵の SELECT の字面(行の鍵なし・鍵の順・続き)、束ごとに remove(条件つき)、
// 失敗の鍵は記録して先へ・投げた束も記録して先へ・後ろの項目は回る・締切で切れれば印を進めない・既定の束 50・remove の字面の止め。
// 実行: pnpm test src/lib/cron/expiry.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import {
  EXPIRY_FAILED_LIST_MAX,
  expiryDeleteQuery,
  expirySelectKeysQuery,
  runExpiryRules,
  type ExpiryRemove,
  type ExpiryRemoveContext,
  type ExpiryRule,
  type ExpiryRuleItem,
  type ExpiryStore,
} from "./expiry";

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
    async selectKeys() {
      return [];
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

// ---- 消し方 remove の項目 ----

test("remove の SQL: 鍵だけを選び、行の鍵を持たず(FOR UPDATE なし)、鍵の順に続きから", () => {
  const rule: ExpiryRule = { table: "users", key: "id", rule: { kind: "age", column: "created_at", days: 7 }, where: sql`is_demo`, remove: async () => ({ removed: 0, failed: [] }) };
  const first = dialect.sqlToQuery(expirySelectKeysQuery(rule, 50, new Date("2026-01-01T00:00:00Z"), null));
  assert.equal(
    first.sql,
    'SELECT "id"::text AS k FROM "users" WHERE ("created_at" < $1::timestamptz - make_interval(days => $2) AND (is_demo)) ORDER BY "id" LIMIT $3',
  );
  assert.deepEqual(first.params, ["2026-01-01T00:00:00.000Z", 7, 50]);
  const next = dialect.sqlToQuery(expirySelectKeysQuery(rule, 50, new Date("2026-01-01T00:00:00Z"), "k-10"));
  assert.match(next.sql, /\) AND "id" > \$3 ORDER BY "id" LIMIT \$4$/);
  assert.equal(next.params[2], "k-10");
  assert.doesNotMatch(next.sql, /FOR UPDATE|DELETE/);
});

/** 鍵の表の偽物: rows = 条件に合う鍵(表ごと、鍵の順)。selectKeys は afterKey の後ろから n 件、remove が消した鍵は消える */
function keyStore(rows: Record<string, string[]>) {
  const selects: string[] = [];
  const store: ExpiryStore = {
    async withTryLock(_key, fn) {
      return { locked: true, value: await fn() };
    },
    async deleteBatch() {
      return 0;
    },
    async selectKeys(rule, batchSize, _now, afterKey) {
      selects.push(`${rule.table}:${batchSize}:${afterKey ?? "-"}`);
      return [...(rows[rule.table] ?? [])].sort().filter((key) => afterKey === null || key > afterKey).slice(0, batchSize);
    },
  };
  return { store, selects, rows };
}

/** remove の偽物: fail の鍵は失敗、throwOn の鍵を含む束は投げる、ほかは表から消す(もう無い鍵も消せたと数える) */
function remover(rows: Record<string, string[]>, table: string, options: { fail?: string[]; throwOn?: string[] } = {}) {
  const calls: { keys: string[]; ctx: ExpiryRemoveContext }[] = [];
  const remove: ExpiryRemove = async (keys, ctx) => {
    calls.push({ keys, ctx });
    if (keys.some((key) => options.throwOn?.includes(key))) throw new Error("provider down");
    const failed = keys.filter((key) => options.fail?.includes(key)).map((key) => ({ key, error: "busy" }));
    const done = keys.filter((key) => !options.fail?.includes(key));
    rows[table] = (rows[table] ?? []).filter((key) => !done.includes(key));
    return { removed: done.length, failed };
  };
  return { remove, calls };
}

const keys = (n: number, prefix = "k") => Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(3, "0")}`);

test("remove: 既定の束 50 で鍵の順に選び、束ごとに remove を条件つきで呼び、選び切れば印を進める", async () => {
  const { store, selects, rows } = keyStore({ demo_users: keys(120) });
  const { remove, calls } = remover(rows, "demo_users");
  const { checkpoint, marks } = checkpoints();
  const now = new Date(7000);
  const result = await runExpiryRules({ items: [item("demo", "demo_users", { remove })], store, checkpoint, deadline: far(), now: () => now });
  assert.deepEqual(selects, ["demo_users:50:-", "demo_users:50:k-049", "demo_users:50:k-099"]);
  assert.deepEqual(calls.map((c) => c.keys.length), [50, 50, 20]);
  const condition = dialect.sqlToQuery(calls[0].ctx.condition);
  assert.equal(condition.sql, '"expires_at" < $1::timestamptz', "持ち主が確かめ直す条件 = 選んだ条件");
  assert.equal(calls[0].ctx.now, now);
  assert.deepEqual(result, { items: [{ name: "demo/demo_users", deleted: 120, exhausted: true, failed: { count: 0, keys: [] } }], truncated: false });
  assert.equal(rows.demo_users.length, 0);
  assert.equal(marks.get("expiry-prune:demo/demo_users")?.getTime(), 7000);
});

test("remove: 失敗の鍵・投げた束は記録して鍵の順に先へ進み、後ろの項目も回る。失敗の行は次の回にもう一度選ばれる", async () => {
  const { store, rows } = keyStore({ demo_users: keys(6), b_rows: ["x"] });
  const demo = remover(rows, "demo_users", { fail: ["k-001"], throwOn: ["k-003"] });
  const b = remover(rows, "b_rows");
  const { checkpoint, marks } = checkpoints({ "expiry-prune:b/b_rows": 9000 });
  const result = await runExpiryRules({
    items: [item("demo", "demo_users", { remove: demo.remove, batchSize: 2 }), item("b", "b_rows", { remove: b.remove })],
    store,
    checkpoint,
    deadline: far(),
  });
  assert.deepEqual(demo.calls.map((c) => c.keys), [["k-000", "k-001"], ["k-002", "k-003"], ["k-004", "k-005"]]);
  assert.deepEqual(result.items[0], {
    name: "demo/demo_users",
    deleted: 3,
    exhausted: true,
    failed: { count: 3, keys: [{ key: "k-001", error: "busy" }, { key: "k-002", error: "provider down" }, { key: "k-003", error: "provider down" }] },
  });
  assert.deepEqual(result.items[1], { name: "b/b_rows", deleted: 1, exhausted: true, failed: { count: 0, keys: [] } }, "後ろの項目は詰まらない");
  assert.equal(result.truncated, false);
  assert.ok(marks.has("expiry-prune:demo/demo_users"), "選び切れば失敗があっても印を進める");
  assert.deepEqual(rows.demo_users, ["k-001", "k-002", "k-003"], "失敗の行は残る");

  const again = remover(rows, "demo_users");
  await runExpiryRules({ items: [item("demo", "demo_users", { remove: again.remove, batchSize: 2 })], store, checkpoint, deadline: far() });
  assert.deepEqual(again.calls.map((c) => c.keys), [["k-001", "k-002"], ["k-003"]], "次の回にもう一度選ばれる");
  assert.deepEqual(rows.demo_users, []);
});

test("remove: 失敗の鍵の一覧は上限まで、数は全部", async () => {
  const { store, rows } = keyStore({ demo_users: keys(30) });
  const { remove } = remover(rows, "demo_users", { fail: keys(30) });
  const { checkpoint } = checkpoints();
  const result = await runExpiryRules({ items: [item("demo", "demo_users", { remove })], store, checkpoint, deadline: far() });
  assert.equal(result.items[0].failed?.count, 30);
  assert.equal(result.items[0].failed?.keys.length, EXPIRY_FAILED_LIST_MAX);
});

test("remove: 締切で切れた項目は印を進めず truncated、直の DELETE の項目は今のまま(selectKeys を呼ばない)", async () => {
  const { store, selects, rows } = keyStore({ demo_users: keys(3) });
  const { remove, calls } = remover(rows, "demo_users");
  const { checkpoint, marks } = checkpoints();
  const cut = await runExpiryRules({ items: [item("demo", "demo_users", { remove })], store, checkpoint, deadline: new Date(Date.now() - 1) });
  assert.equal(cut.truncated, true);
  assert.equal(marks.size, 0);
  assert.deepEqual(calls, []);

  const plain = fakeStore({ a_rows: 3 });
  await runExpiryRules({ items: [item("a", "a_rows")], store: plain.store, checkpoint, deadline: far() });
  assert.deepEqual(plain.calls, ["a_rows:1000"]);
  assert.deepEqual(selects, []);
});

test("remove の字面: 関数でない remove・束 1000 超は消す前に止める(直の DELETE の上限 10000 は今のまま)", async () => {
  const { store, selects } = keyStore({ demo_users: keys(3) });
  const { checkpoint } = checkpoints();
  const run = (plug: Partial<ExpiryRule>) => runExpiryRules({ items: [item("demo", "demo_users", plug)], store, checkpoint, deadline: far() });
  await assert.rejects(run({ remove: "hardDelete" as unknown as ExpiryRemove }), /remove は関数/);
  await assert.rejects(run({ remove: async () => ({ removed: 0, failed: [] }), batchSize: 1001 }), /batchSize 1001 は 1〜1000 の整数\(remove の項目\)/);
  assert.deepEqual(selects, []);
  const plain = fakeStore({ a_rows: 1 });
  await runExpiryRules({ items: [item("a", "a_rows", { batchSize: 5000 })], store: plain.store, checkpoint, deadline: far() });
  assert.deepEqual(plain.calls, ["a_rows:5000"]);
});
