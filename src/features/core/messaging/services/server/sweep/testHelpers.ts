// src/features/core/messaging/services/server/sweep/testHelpers.ts
//
// 掃き出し・保持の単体テストの部品: 送る口のメモリの store に、掃き出しと保持の操作を足す(SQL と同じ規則)。テストだけが読む。

import type { MessageDispatch, MessageDeliveryInsert } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE } from "../../../entities/schema";
import { createDeps, createMemoryStore, type MemoryStore } from "../sendMessage/testHelpers";
import type { MessageSendDeps } from "../sendMessage/types";
import type { MessageRetentionStore, MessageSweepDeps, MessageSweepStore } from "./types";

export type MemoryWorld = {
  store: MemoryStore;
  sweepStore: MessageSweepStore;
  retentionStore: MessageRetentionStore;
  inboxDispatchIds: Set<string>;
  movedKeyRows: { idempotency_key: string; dispatch_id: string; createdAt: Date }[];
  events: { id: string; createdAt: Date }[];
};

const time = (value: Date | null | undefined) => (value ? value.getTime() : null);

export function createMemoryWorld(): MemoryWorld {
  const store = createMemoryStore();
  const inboxDispatchIds = new Set<string>();
  const movedKeyRows: MemoryWorld["movedKeyRows"] = [];
  const events: MemoryWorld["events"] = [];
  const dispatches = () => store.dispatches as unknown as MessageDispatch[];

  const sweepStore: MessageSweepStore = {
    async activateScheduled(now, limit) {
      const due = dispatches()
        .filter((d) => d.status === "scheduled" && d.scheduled_at && d.scheduled_at <= now)
        .slice(0, limit);
      for (const d of due) d.status = "processing";
      return due.length;
    },
    async expandOne(dispatchId, step) {
      const target = dispatches().find(
        (d) =>
          d.status === "processing" &&
          d.message_key &&
          d.expand_cursor !== MESSAGE_EXPAND_DONE &&
          (!dispatchId || d.id === dispatchId),
      );
      if (!target) return false;
      const write = await step({ ...target });
      await store.insertDeliveries(write.rows as MessageDeliveryInsert[]);
      Object.assign(target, write.patch);
      return true;
    },
    async claimDue({ now, limit, leaseUntil, lockToken, dispatchId }) {
      const due = store.deliveries
        .filter(
          (row) =>
            row.next_attempt_at &&
            row.next_attempt_at <= now &&
            (row.status === "queued" || row.status === "sent") &&
            (!row.locked_until || row.locked_until < now) &&
            (!dispatchId || row.dispatch_id === dispatchId),
        )
        .sort((a, b) => time(a.next_attempt_at)! - time(b.next_attempt_at)!)
        .slice(0, limit);
      for (const row of due) Object.assign(row, { status: "sending", locked_until: leaseUntil, lock_token: lockToken });
      return due.map((row) => ({ ...row }));
    },
    async updateClaimed(id, lockToken, patch) {
      const row = store.deliveries.find((item) => item.id === id && item.lock_token === lockToken);
      if (row) Object.assign(row, patch);
    },
    async markStaleSending(now) {
      const stale = store.deliveries.filter((row) => row.status === "sending" && row.locked_until && row.locked_until < now);
      for (const row of stale) {
        Object.assign(row, { status: "unknown", last_error: "stale_sending", next_attempt_at: null, locked_until: null, lock_token: null });
      }
      return stale.length;
    },
    async findDispatches(ids) {
      return dispatches().filter((d) => ids.includes(d.id)).map((d) => ({ ...d }));
    },
    async findCompletable(limit, dispatchId) {
      return dispatches()
        .filter(
          (d) =>
            d.status === "processing" &&
            d.expand_cursor === MESSAGE_EXPAND_DONE &&
            (!dispatchId || d.id === dispatchId) &&
            !store.deliveries.some(
              (row) =>
                row.dispatch_id === d.id &&
                (row.status === "queued" || row.status === "sending" || row.next_attempt_at !== null),
            ),
        )
        .slice(0, limit)
        .map((d) => ({ ...d }));
    },
    async aggregateDeliveries(dispatchId) {
      const counts = new Map<string, { channel: string; status: string; count: number }>();
      for (const row of store.deliveries.filter((item) => item.dispatch_id === dispatchId)) {
        const key = `${row.channel}|${row.status}`;
        const entry = counts.get(key) ?? { channel: row.channel, status: row.status, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      }
      return [...counts.values()];
    },
    async updateDispatch(id, patch) {
      await store.updateDispatch(id, patch);
    },
  };

  const take = <T>(rows: T[], limit: number) => rows.slice(0, limit);
  const retentionStore: MessageRetentionStore = {
    async deleteEventsBefore(cutoff, limit) {
      const gone = take(events.filter((e) => e.createdAt < cutoff), limit);
      for (const e of gone) events.splice(events.indexOf(e), 1);
      return gone.length;
    },
    async deleteDeliveriesBefore(cutoff, limit) {
      const gone = take(
        store.deliveries.filter((row) => row.createdAt < cutoff && row.status !== "queued" && row.status !== "sending"),
        limit,
      );
      store.deliveries = store.deliveries.filter((row) => !gone.includes(row));
      return gone.length;
    },
    async deleteDispatchesBefore(cutoff, limit) {
      const gone = take(
        dispatches().filter(
          (d) =>
            d.createdAt < cutoff && d.status !== "processing" && d.status !== "scheduled" && !inboxDispatchIds.has(d.id),
        ),
        limit,
      );
      let movedKeys = 0;
      for (const d of gone) {
        if (d.idempotency_key && !store.movedKeys.has(d.idempotency_key)) {
          store.movedKeys.add(d.idempotency_key);
          movedKeyRows.push({ idempotency_key: d.idempotency_key, dispatch_id: d.id, createdAt: cutoff });
          movedKeys += 1;
        }
      }
      const ids = new Set(gone.map((d) => d.id));
      store.dispatches = store.dispatches.filter((d) => !ids.has(d.id));
      // 回を消すと配達の行も消える(FK CASCADE)
      store.deliveries = store.deliveries.filter((row) => !ids.has(row.dispatch_id));
      return { deleted: gone.length, movedKeys };
    },
    async deleteIdempotencyKeysBefore(cutoff, limit) {
      const gone = take(movedKeyRows.filter((row) => row.createdAt < cutoff), limit);
      for (const row of gone) {
        movedKeyRows.splice(movedKeyRows.indexOf(row), 1);
        store.movedKeys.delete(row.idempotency_key);
      }
      return gone.length;
    },
  };

  return { store, sweepStore, retentionStore, inboxDispatchIds, movedKeyRows, events };
}

export function createSweepDeps(
  world: MemoryWorld,
  overrides: Partial<Omit<MessageSendDeps, "store">> = {},
): MessageSweepDeps & { slept: number[]; setNow: (date: Date) => void } {
  let now = new Date("2026-11-10T00:00:00.000Z");
  let token = 0;
  const base = createDeps({ ...overrides, store: world.store });
  return {
    ...base,
    now: () => now,
    setNow: (date: Date) => {
      now = date;
    },
    sweepStore: world.sweepStore,
    newToken: () => `token-${(token += 1)}`,
  };
}
