// 購読の cron(runSubscribers / reprocessQuarantined)の検査(メモリの store と、テストの中だけの固定の購読)
// - 印から seq 順に、lag より前の事件だけ、on と filter に合う束を handle へ。成功で印を進める
// - 束の失敗は 1 件ずつ渡し直し: 前の事件は済み、失敗した事件で印を止める(次の実行で渡し直す = 少なくとも 1 回)
// - 同じ事件が maxAttempts 回失敗したら隔離して先へ進む。隔離した事件は再処理できる
// - 合う事件を読み切ったら上限(lag より前の一番大きい seq)まで印を進める。保持の掃除が読む一番遅い印
// 実行: pnpm test src/features/core/messaging/services/server/subscribers
import { test } from "node:test";
import assert from "node:assert/strict";

import type { MessageSubscriber } from "@/lib/messaging";

import { testConfig } from "../sendMessage/testHelpers";
import { reprocessQuarantined, runSubscribers, type SubscriberRunDeps } from "./runSubscribers";
import type { SubscriberEvent, SubscriberStore } from "./types";

const NOW = new Date("2026-11-12T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);
const deadline = () => ({ deadline: new Date(Date.now() + 60_000) });

type StoredEvent = SubscriberEvent & { createdAt: Date };

function memoryStore(events: StoredEvent[]) {
  const marks = new Map<string, number>();
  const failures = new Map<string, { attempts: number; lastError: string; quarantinedAt: Date | null }>();
  const fkey = (s: string, e: string) => `${s}|${e}`;
  const store: SubscriberStore = {
    getMark: async (key) => marks.get(key) ?? 0,
    advanceMark: async (key, seq) => {
      marks.set(key, Math.max(marks.get(key) ?? 0, seq));
    },
    upperSeq: async (cutoff) => Math.max(0, ...events.filter((e) => e.createdAt <= cutoff).map((e) => e.seq)),
    fetchEvents: async ({ after, upTo, types, messages, channels, limit }) =>
      events
        .filter(
          (e) =>
            e.seq > after &&
            e.seq <= upTo &&
            types.includes(e.type) &&
            (!messages?.length || (e.messageKey !== null && messages.includes(e.messageKey))) &&
            (!channels?.length || (e.channel !== null && channels.includes(e.channel))),
        )
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit),
    findEvents: async (ids) => events.filter((e) => ids.includes(e.id)),
    recordFailure: async ({ subscriberKey, eventId, error, maxAttempts, now }) => {
      const current = failures.get(fkey(subscriberKey, eventId)) ?? { attempts: 0, lastError: "", quarantinedAt: null };
      const attempts = current.attempts + 1;
      const next = { attempts, lastError: error, quarantinedAt: current.quarantinedAt ?? (attempts >= maxAttempts ? now : null) };
      failures.set(fkey(subscriberKey, eventId), next);
      return { attempts, quarantined: next.quarantinedAt !== null };
    },
    clearFailures: async (key, ids) => {
      for (const id of ids) failures.delete(fkey(key, id));
    },
    listQuarantined: async (key, ids) =>
      [...failures.entries()]
        .filter(([k, v]) => k.startsWith(`${key}|`) && v.quarantinedAt && (!ids?.length || ids.includes(k.split("|")[1])))
        .map(([k]) => k.split("|")[1]),
    slowestMark: async (keys) => (keys.length === 0 ? null : Math.min(...keys.map((key) => marks.get(key) ?? 0))),
  };
  return { store, marks, failures };
}

function event(seq: number, type: string, extra: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: `e${seq}`,
    seq,
    type,
    messageKey: "shop.notice",
    dispatchId: "d1",
    deliveryId: `r${seq}`,
    channel: "email",
    occurredAt: ago(600),
    payload: {},
    createdAt: ago(600),
    ...extra,
  };
}

function fixture(on: string[], handle: (events: readonly SubscriberEvent[]) => Promise<void>, filter?: MessageSubscriber["filter"]): MessageSubscriber {
  // cron が渡す事件は seq つき(SubscriberEvent)
  return { key: "fixture", on, filter, handle: (events) => handle(events as readonly SubscriberEvent[]) };
}

function deps(store: SubscriberStore, subscriber: MessageSubscriber): SubscriberRunDeps {
  return { store, subscribers: { [subscriber.key]: subscriber }, config: testConfig, now: () => NOW };
}

test("印から seq 順・lag より前・on と filter に合う事件を束(batchSize 2)で渡し、上限まで印を進める", async () => {
  const events = [
    event(1, "delivery.sent"),
    event(2, "delivery.failed"),
    event(3, "delivery.sent", { messageKey: "other.key" }),
    event(4, "delivery.sent", { channel: "inApp" }),
    event(5, "delivery.sent"),
    event(6, "delivery.sent"),
    event(7, "delivery.sent", { createdAt: ago(30) }), // lag(120 秒)より新しい
  ];
  const { store, marks } = memoryStore(events);
  const batches: number[][] = [];
  const subscriber = fixture(["delivery.sent"], async (batch) => {
    batches.push(batch.map((e) => e.seq));
  }, { messages: ["shop.notice"], channels: ["email"] });
  const result = await runSubscribers(deps(store, subscriber), deadline());
  assert.deepEqual(batches, [[1, 5], [6]]);
  assert.equal(result.delivered, 3);
  assert.equal(marks.get("fixture"), 6);

  // 次の実行は印の後だけ(7 は lag を過ぎてから)
  events[6].createdAt = ago(600);
  await runSubscribers(deps(store, subscriber), deadline());
  assert.deepEqual(batches.at(-1), [7]);
  assert.equal(marks.get("fixture"), 7);
});

test("束の失敗は 1 件ずつ渡し直し、失敗した事件で印を止める(次の実行で同じ事件をもう一度)", async () => {
  const { store, marks, failures } = memoryStore([event(1, "delivery.sent"), event(2, "delivery.sent"), event(3, "delivery.sent")]);
  const seen: number[][] = [];
  let failOn = 2;
  const subscriber = fixture(["delivery.sent"], async (batch) => {
    seen.push(batch.map((e) => e.seq));
    if (batch.some((e) => e.seq === failOn)) throw new Error("boom");
  });
  const first = await runSubscribers(deps(store, subscriber), deadline());
  assert.deepEqual(seen, [[1, 2], [1], [2]]);
  assert.equal(marks.get("fixture"), 1);
  assert.equal(first.failed, 1);
  assert.equal(failures.get("fixture|e2")?.attempts, 1);

  failOn = -1;
  await runSubscribers(deps(store, subscriber), deadline());
  assert.deepEqual(seen.slice(3), [[2, 3]]);
  assert.equal(marks.get("fixture"), 3);
  assert.equal(failures.size, 0);
});

test("同じ事件が maxAttempts(3)回失敗したら隔離して先へ進み、再処理で渡し直せる", async () => {
  const { store, marks, failures } = memoryStore([event(1, "delivery.sent"), event(2, "delivery.sent")]);
  let broken = true;
  const handled: number[] = [];
  const subscriber = fixture(["delivery.sent"], async (batch) => {
    if (broken && batch.some((e) => e.seq === 1)) throw new Error("boom");
    handled.push(...batch.map((e) => e.seq));
  });
  for (let i = 0; i < 2; i += 1) await runSubscribers(deps(store, subscriber), deadline());
  assert.equal(marks.get("fixture") ?? 0, 0);
  const third = await runSubscribers(deps(store, subscriber), deadline());
  assert.equal(third.quarantined, 1);
  assert.equal(marks.get("fixture"), 2);
  assert.deepEqual(handled, [2]);
  assert.ok(failures.get("fixture|e1")?.quarantinedAt);

  // 再処理: まだ壊れていれば隔離のまま、直れば失敗の行を消す
  assert.deepEqual(await reprocessQuarantined(deps(store, subscriber), "fixture"), { reprocessed: 0, failed: 1 });
  assert.ok(failures.get("fixture|e1")?.quarantinedAt);
  broken = false;
  assert.deepEqual(await reprocessQuarantined(deps(store, subscriber), "fixture", ["e1"]), { reprocessed: 1, failed: 0 });
  assert.equal(failures.size, 0);
  await assert.rejects(reprocessQuarantined(deps(store, subscriber), "none"));
});

test("合う事件が無くても上限まで印を進める(保持の掃除を止めない)、on が空の購読は読まない", async () => {
  const { store, marks } = memoryStore([event(1, "delivery.failed"), event(2, "opened")]);
  const result = await runSubscribers(deps(store, fixture(["delivery.sent"], async () => {})), deadline());
  assert.equal(result.delivered, 0);
  assert.equal(marks.get("fixture"), 2);
  assert.equal(await store.slowestMark(["fixture"]), 2);

  const idle = memoryStore([event(1, "delivery.sent")]);
  const none = await runSubscribers(deps(idle.store, fixture([], async () => {})), deadline());
  assert.equal(none.subscribers, 0);
  assert.equal(idle.marks.size, 0);
});
