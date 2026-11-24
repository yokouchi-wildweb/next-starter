// src/domains/core/outbox/services/server/outbox.test.mts
// 送り箱(createOutbox・createOutboxDispatch)を偽物の表・取引・after で回す: 積む(重複・kind・版の欄・schema)、withOutbox の順(積む → コミット → 押す)、
// 押すは投げない、1 行の処理(届けた・再試行の間隔と頭打ち・上限で隔離・未設定の基底と閉じたドメインの保留)、定期処理(1 本・閉じた kind を取らない・二重に動いても同じ)、
// 再処理(何度流しても同じ)、監視としきい値。実行: pnpm test src/domains/core/outbox/services/server/outbox.test.mts
import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import { BackendNotConfiguredError } from "@/lib/errors";

import type { OutboxJobRow } from "../../entities/model";
import type { OutboxHandler } from "../../points";
import { createOutboxDispatch, outboxThresholdHits, OutboxThresholdExceededError } from "./dispatch";
import { createOutbox, outboxBackoffSeconds } from "./outbox";
import type { OutboxInsert, OutboxStore } from "./store";

const RETRY = { maxAttempts: 3, backoff: { baseSeconds: 10, maxSeconds: 25 } };
const T0 = new Date("2026-01-01T00:00:00Z");

type Tx = { name: string };

function fakeStore() {
  const rows = new Map<string, OutboxJobRow>();
  const events: string[] = [];
  let seq = 0;
  let lockHeld = false;
  const due = (row: OutboxJobRow, now: Date) =>
    (row.status === "pending" && row.next_attempt_at.getTime() <= now.getTime()) ||
    (row.status === "running" && row.lease_until !== null && row.lease_until.getTime() < now.getTime());
  const take = (row: OutboxJobRow, now: Date) => {
    row.status = "running";
    row.lease_until = new Date(now.getTime() + 60_000);
    return { ...row };
  };
  const store: OutboxStore<Tx> = {
    async insert(tx, row: OutboxInsert) {
      events.push(`insert:${tx.name}:${row.kind}`);
      const found = [...rows.values()].find((r) => r.kind === row.kind && r.idempotency_key === row.idempotencyKey);
      if (found) return { id: found.id, duplicate: true };
      const id = `row-${++seq}`;
      const at = new Date(0);
      rows.set(id, {
        id, kind: row.kind, payload: row.payload, idempotency_key: row.idempotencyKey, status: "pending", attempts: 0,
        next_attempt_at: row.notBefore ?? at, lease_until: null, last_error: null, created_at: at, updated_at: at, done_at: null, quarantined_at: null,
      });
      return { id, duplicate: false };
    },
    async claim(id, now) {
      const row = rows.get(id);
      if (!row || !due(row, now)) return null;
      return take(row, now);
    },
    async claimBatch(kinds, limit, now) {
      return [...rows.values()]
        .filter((row) => kinds.includes(row.kind) && due(row, now))
        .slice(0, limit)
        .map((row) => take(row, now));
    },
    async markDone(id) {
      Object.assign(rows.get(id)!, { status: "done", lease_until: null });
      events.push(`done:${id}`);
    },
    async release(id) {
      Object.assign(rows.get(id)!, { status: "pending", lease_until: null });
      events.push(`release:${id}`);
    },
    async hold(id, error, nextAttemptAt) {
      Object.assign(rows.get(id)!, { status: "pending", lease_until: null, last_error: error, next_attempt_at: nextAttemptAt });
      events.push(`hold:${id}`);
    },
    async markFailed(id, error, nextAttemptAt) {
      const row = rows.get(id)!;
      Object.assign(row, { status: "pending", lease_until: null, attempts: row.attempts + 1, last_error: error, next_attempt_at: nextAttemptAt });
      events.push(`failed:${id}`);
    },
    async markQuarantined(id, error, now) {
      const row = rows.get(id)!;
      Object.assign(row, { status: "quarantined", lease_until: null, attempts: row.attempts + 1, last_error: error, quarantined_at: now });
      events.push(`quarantined:${id}`);
    },
    async withRunnerLock(_key, fn) {
      if (lockHeld) return { locked: false };
      lockHeld = true;
      try {
        return { locked: true, value: await fn() };
      } finally {
        lockHeld = false;
      }
    },
    async countByKind() {
      const byKind = new Map<string, { kind: string; pending: number; quarantined: number; oldestPendingAt: Date | null }>();
      for (const row of rows.values()) {
        if (row.status === "done") continue;
        const entry = byKind.get(row.kind) ?? { kind: row.kind, pending: 0, quarantined: 0, oldestPendingAt: null };
        if (row.status === "quarantined") entry.quarantined += 1;
        else {
          entry.pending += 1;
          if (!entry.oldestPendingAt || row.created_at < entry.oldestPendingAt) entry.oldestPendingAt = row.created_at;
        }
        byKind.set(row.kind, entry);
      }
      return [...byKind.values()];
    },
    async reprocess(filter, now) {
      let count = 0;
      for (const row of rows.values()) {
        if (row.status !== "quarantined") continue;
        if (filter.kinds?.length && !filter.kinds.includes(row.kind)) continue;
        if (filter.ids?.length && !filter.ids.includes(row.id)) continue;
        Object.assign(row, { status: "pending", attempts: 0, next_attempt_at: now, quarantined_at: null });
        count += 1;
      }
      return count;
    },
  };
  return { store, rows, events, setLock: (held: boolean) => (lockHeld = held) };
}

const handled: string[] = [];
const ok: OutboxHandler<{ v: number; to: string }> = {
  kind: "auth.sync",
  schema: z.object({ v: z.number(), to: z.string() }),
  async handle(payload, ctx) {
    handled.push(`${ctx.id}:${payload.to}:${ctx.attempt}`);
  },
};
const boom: OutboxHandler = {
  kind: "mail.notify",
  schema: z.object({ v: z.number() }).passthrough(),
  async handle() {
    throw new TypeError("provider down");
  },
};

function setup(options: { open?: OutboxHandler[]; all?: OutboxHandler[]; after?: (task: () => Promise<void>) => void; now?: () => Date } = {}) {
  const fake = fakeStore();
  const kicked: Array<() => Promise<void>> = [];
  const logs: string[] = [];
  const outbox = createOutbox<Tx>({
    store: fake.store,
    transaction: async (fn) => {
      fake.events.push("begin");
      const value = await fn({ name: "tx" });
      fake.events.push("commit");
      return value;
    },
    allHandlers: async () => (options.all ?? [ok, boom]) as OutboxHandler[],
    openHandlers: async () => (options.open ?? [ok, boom]) as OutboxHandler[],
    retry: RETRY,
    now: options.now,
    after: options.after ?? ((task) => {
      fake.events.push("after");
      kicked.push(task);
    }),
    log: (line) => logs.push(line),
  });
  const dispatch = createOutboxDispatch<Tx>({
    store: fake.store,
    allHandlers: async () => (options.all ?? [ok, boom]) as OutboxHandler[],
    openHandlers: async () => (options.open ?? [ok, boom]) as OutboxHandler[],
    processClaimedRow: outbox.processClaimedRow,
    config: { dispatch: { budgetMs: 60_000, batchSize: 2 }, thresholds: { pending: 2, oldestWaitSeconds: 0, quarantined: 1, noHandler: true } },
    now: options.now,
  });
  return { ...fake, outbox, dispatch, kicked, logs };
}

const far = () => new Date(Date.now() + 60_000);

test("積む: 重複は積まずに duplicate、知らない kind・版の欄の無い payload・schema に合わない payload・tx の無い呼び出しは投げる", async () => {
  const { outbox, rows } = setup();
  const first = await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "k1" });
  assert.deepEqual(first, { id: "row-1", duplicate: false });
  assert.deepEqual(await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "k1" }), { id: "row-1", duplicate: true });
  assert.equal(rows.size, 1);
  await assert.rejects(outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.unknown", payload: { v: 1 }, idempotencyKey: "k" }), /処理の項目が無い/);
  await assert.rejects(outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { to: "a" } as never, idempotencyKey: "k" }), /版の欄 v/);
  await assert.rejects(outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: 3 }, idempotencyKey: "k" }), /schema に合わない/);
  await assert.rejects(outbox.enqueueOutbox(null as never, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "k" }), /tx が要る/);
});

test("withOutbox: fn の中で積む → コミット → 新しい行だけを押す、fn が投げれば押さない", async () => {
  const { outbox, events, kicked } = setup();
  const value = await outbox.withOutbox(async ({ enqueue }) => {
    await enqueue({ kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "k1" });
    await enqueue({ kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "k1" });
    return "result";
  });
  assert.equal(value, "result");
  assert.deepEqual(events, ["begin", "insert:tx:auth.sync", "insert:tx:auth.sync", "commit", "after"]);
  assert.equal(kicked.length, 1);
  handled.length = 0;
  await kicked[0]();
  assert.deepEqual(handled, ["row-1:a:1"]);
  const before = kicked.length;
  await assert.rejects(outbox.withOutbox(async ({ enqueue }) => {
    await enqueue({ kind: "auth.sync", payload: { v: 1, to: "b" }, idempotencyKey: "k2" });
    throw new Error("rollback");
  }), /rollback/);
  assert.equal(kicked.length, before, "投げた時は押さない");
});

test("kickOutbox: after が投げても(要求の外)・処理が投げても投げない、空なら何もしない", async () => {
  const thrower = setup({ after: () => { throw new Error("after() outside a request"); } });
  assert.doesNotThrow(() => thrower.outbox.kickOutbox(["row-1"]));
  assert.match(thrower.logs.join("\n"), /"phase":"kick"/);
  const failing = setup();
  failing.store.claim = async () => {
    throw new Error("db down");
  };
  failing.outbox.kickOutbox(["x"]);
  await assert.doesNotReject(failing.kicked[0]());
  assert.match(failing.logs.join("\n"), /"id":"x"/);
  const empty = setup();
  empty.outbox.kickOutbox([]);
  assert.equal(empty.kicked.length, 0);
});

test("1 行の処理: 届けた → done、投げた → 試行を 1 足して待ち、閉じたドメインの kind → 数えずに戻す(保留)、取れない → skipped", async () => {
  const { outbox, rows } = setup({ open: [ok] });
  const a = await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "a" });
  assert.equal(await outbox.processOutboxRow(a.id), "done");
  assert.equal(rows.get(a.id)!.status, "done");
  assert.equal(await outbox.processOutboxRow(a.id), "skipped");
  const held = await outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "m" });
  assert.equal(await outbox.processOutboxRow(held.id), "held");
  assert.equal(rows.get(held.id)!.attempts, 0);
  assert.equal(rows.get(held.id)!.status, "pending");
  const open = setup();
  const failed = await open.outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "m" });
  assert.equal(await open.outbox.processOutboxRow(failed.id), "failed");
  assert.equal(open.rows.get(failed.id)!.attempts, 1);
  assert.equal(open.rows.get(failed.id)!.last_error, "TypeError: provider down");
});

test("再試行の間隔: baseSeconds × 2^(試行 − 1)、maxSeconds で頭打ち、項目の backoff が既定より先", () => {
  const defaults = { baseSeconds: 10, maxSeconds: 25 };
  assert.deepEqual([1, 2, 3, 4].map((n) => outboxBackoffSeconds(n, undefined, defaults)), [10, 20, 25, 25]);
  assert.deepEqual([1, 2, 3].map((n) => outboxBackoffSeconds(n, { baseSeconds: 1 }, defaults)), [1, 2, 4]);
  assert.equal(outboxBackoffSeconds(5, { baseSeconds: 1, maxSeconds: 8 }, defaults), 8);
});

test("失敗 → 次の時刻は間隔の後、maxAttempts(既定 3)で隔離して消さない。項目の maxAttempts が既定より先", async () => {
  let clock = T0;
  const { outbox, rows } = setup({ now: () => clock });
  const { id } = await outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "m" });
  assert.equal(await outbox.processOutboxRow(id), "failed");
  assert.equal(rows.get(id)!.next_attempt_at.getTime(), T0.getTime() + 10_000);
  assert.equal(await outbox.processOutboxRow(id), "skipped", "時が来ていない");
  clock = new Date(T0.getTime() + 10_000);
  assert.equal(await outbox.processOutboxRow(id), "failed");
  assert.equal(rows.get(id)!.next_attempt_at.getTime(), clock.getTime() + 20_000);
  clock = new Date(clock.getTime() + 20_000);
  assert.equal(await outbox.processOutboxRow(id), "quarantined");
  assert.equal(rows.get(id)!.status, "quarantined");
  assert.equal(rows.get(id)!.attempts, 3);
  assert.equal(rows.size, 1, "消さない");
  const once: OutboxHandler = { ...boom, kind: "mail.once", maxAttempts: 1 };
  const single = setup({ all: [once], open: [once] });
  const row = await single.outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.once", payload: { v: 1 }, idempotencyKey: "o" });
  assert.equal(await single.outbox.processOutboxRow(row.id), "quarantined");
});

test("未設定の基底(BackendNotConfiguredError の子)→ 保留: 試行を数えず次の時刻だけ延ばす、隔離しない", async () => {
  let clock = T0;
  class MailNotConfigured extends BackendNotConfiguredError {
    constructor() {
      super("mail not configured", { port: "mail", missing: ["MAIL_API_KEY"], side: "server" });
      this.name = "MailNotConfiguredError";
    }
  }
  const unconfigured: OutboxHandler = { kind: "mail.send", schema: z.object({ v: z.number() }).passthrough(), async handle() { throw new MailNotConfigured(); } };
  const { outbox, rows } = setup({ all: [unconfigured], open: [unconfigured], now: () => clock });
  const { id } = await outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.send", payload: { v: 1 }, idempotencyKey: "s" });
  for (let i = 0; i < 5; i += 1) {
    assert.equal(await outbox.processOutboxRow(id), "held");
    assert.equal(rows.get(id)!.attempts, 0);
    assert.equal(rows.get(id)!.status, "pending");
    assert.equal(rows.get(id)!.next_attempt_at.getTime(), clock.getTime() + 10_000);
    clock = new Date(clock.getTime() + 10_000);
  }
  assert.match(rows.get(id)!.last_error ?? "", /MailNotConfiguredError/);
});

test("定期処理: 開いた kind の時の来た行だけを束で届け、閉じたドメインの kind は取らずに保留(数えず pending のまま)。二度目は何もしない", async () => {
  const { outbox, dispatch, rows } = setup({ open: [ok] });
  for (const key of ["a", "b", "c"]) await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: key }, idempotencyKey: key });
  const closed = await outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "m" });
  const first = await dispatch.runOutboxDispatch({ deadline: far() });
  assert.equal(first.locked, false);
  assert.equal(first.done, 3);
  assert.equal(first.truncated, false);
  assert.equal(rows.get(closed.id)!.status, "pending");
  assert.equal(rows.get(closed.id)!.attempts, 0);
  const again = await dispatch.runOutboxDispatch({ deadline: far() });
  assert.deepEqual({ done: again.done, failed: again.failed, held: again.held }, { done: 0, failed: 0, held: 0 });
  const stats = await dispatch.outboxStats();
  assert.deepEqual(stats.map((row) => [row.kind, row.pending, row.handler]), [["mail.notify", 1, "closed"]]);
});

test("定期処理の二重: 鍵を他が持てば何もせず locked、取った行は別の押しが取れない(skipped)", async () => {
  const { outbox, dispatch, rows, setLock, store } = setup();
  const { id } = await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "a" });
  setLock(true);
  const locked = await dispatch.runOutboxDispatch({ deadline: far() });
  assert.equal(locked.locked, true);
  assert.equal(rows.get(id)!.status, "pending");
  setLock(false);
  const [claimed] = await store.claimBatch(["auth.sync"], 10, new Date());
  assert.equal(await outbox.processOutboxRow(id), "skipped", "貸し中の行は取れない");
  assert.equal(await outbox.processClaimedRow(claimed, [ok]), "done");
  assert.equal(await outbox.processOutboxRow(id), "skipped", "済みの行は取れない");
});

test("定期処理: 締切を過ぎていれば束を取らず truncated", async () => {
  const { outbox, dispatch } = setup();
  await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "a" });
  const result = await dispatch.runOutboxDispatch({ deadline: new Date(Date.now() - 1) });
  assert.equal(result.done, 0);
  assert.equal(result.truncated, true);
});

test("再処理: 隔離の行だけを kind・id で絞って試行 0 の待ちへ戻す、何度流しても同じ", async () => {
  const { outbox, dispatch, rows } = setup();
  const once: OutboxHandler = { ...boom, maxAttempts: 1 };
  const failing = setup({ all: [once], open: [once] });
  const a = await failing.outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "a" });
  const b = await failing.outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "b" });
  await failing.outbox.processOutboxRow(a.id);
  await failing.outbox.processOutboxRow(b.id);
  assert.deepEqual(await failing.dispatch.reprocessQuarantined({ ids: [a.id] }), { reprocessed: 1 });
  assert.equal(failing.rows.get(a.id)!.status, "pending");
  assert.equal(failing.rows.get(a.id)!.attempts, 0);
  assert.equal(failing.rows.get(b.id)!.status, "quarantined");
  assert.deepEqual(await failing.dispatch.reprocessQuarantined({ ids: [a.id] }), { reprocessed: 0 }, "二度目は何もしない");
  assert.deepEqual(await failing.dispatch.reprocessQuarantined({ kinds: ["mail.notify"] }), { reprocessed: 1 });
  assert.deepEqual(await failing.dispatch.reprocessQuarantined({ kinds: ["mail.notify"] }), { reprocessed: 0 });
  // 届けた行は触らない
  const done = await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "x" }, idempotencyKey: "x" });
  await outbox.processOutboxRow(done.id);
  assert.deepEqual(await dispatch.reprocessQuarantined({}), { reprocessed: 0 });
  assert.equal(rows.get(done.id)!.status, "done");
});

test("監視: kind ごとの待ち・最古の秒・隔離・処理の項目の状態、しきい値の超えを kind ごとに 1 行記録(0 は見ない)", async () => {
  const clock = new Date(60_000);
  const once: OutboxHandler = { ...boom, maxAttempts: 1 };
  const { outbox, dispatch, rows } = setup({ all: [ok, once], open: [ok, once], now: () => clock });
  await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "a" }, idempotencyKey: "a", notBefore: new Date(120_000) });
  await outbox.enqueueOutbox({ name: "tx" }, { kind: "auth.sync", payload: { v: 1, to: "b" }, idempotencyKey: "b", notBefore: new Date(120_000) });
  const q = await outbox.enqueueOutbox({ name: "tx" }, { kind: "mail.notify", payload: { v: 1 }, idempotencyKey: "q" });
  assert.equal(await outbox.processOutboxRow(q.id), "quarantined");
  rows.set("orphan", { ...rows.get(q.id)!, id: "orphan", kind: "gone.task", status: "pending", idempotency_key: "o", quarantined_at: null });
  const stats = await dispatch.outboxStats();
  assert.deepEqual(stats, [
    { kind: "auth.sync", pending: 2, oldestWaitSeconds: 60, quarantined: 0, handler: "open" },
    { kind: "gone.task", pending: 1, oldestWaitSeconds: 60, quarantined: 0, handler: "none" },
    { kind: "mail.notify", pending: 0, oldestWaitSeconds: 0, quarantined: 1, handler: "open" },
  ]);
  assert.deepEqual(outboxThresholdHits(stats, { pending: 2, oldestWaitSeconds: 0, quarantined: 1, noHandler: true }).map((hit) => `${hit.kind}:${hit.metric}`), [
    "auth.sync:pending",
    "gone.task:noHandler",
    "mail.notify:quarantined",
  ]);
  assert.deepEqual(outboxThresholdHits(stats, { pending: 0, oldestWaitSeconds: 0, quarantined: 0, noHandler: false }), []);
  const reported: Array<{ error: Error; extra: Record<string, unknown> }> = [];
  const result = await dispatch.runOutboxDispatch({ deadline: far(), report: async (error, extra) => void reported.push({ error, extra }) });
  assert.equal(result.alerts, 3);
  assert.ok(reported.every(({ error }) => error instanceof OutboxThresholdExceededError));
  assert.deepEqual(reported.map(({ extra }) => extra.kind), ["auth.sync", "gone.task", "mail.notify"]);
});
