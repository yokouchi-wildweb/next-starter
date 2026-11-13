// src/features/core/messaging/services/server/sendMessage/testHelpers.ts
//
// 送る口の単体テストの部品: メモリの store とテスト用の経路の項目(上流の経路の項目はまだ 0 本)。テストだけが読む。

import { randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  ChannelSendResult,
  ChannelSendTarget,
  MessageCategory,
  MessageChannel,
  MessageRegistry,
} from "@/lib/messaging";

import type { MessagingConfig } from "../../../config";
import type {
  MessageDelivery,
  MessageDeliveryInsert,
  MessageDispatchInsert,
  MessageEventRowInsert,
  MessageInboxItemInsert,
} from "../../../entities/model";
import { MessageIdempotencyConflict } from "./errors";
import type {
  MessageSendDeps,
  MessageSendStore,
  MessageThrottleStore,
  MessageUserRow,
  ThrottleDeliveryRow,
} from "./types";

export type MemoryStore = MessageSendStore & {
  dispatches: (MessageDispatchInsert & { id: string })[];
  deliveries: MessageDelivery[];
  movedKeys: Set<string>;
  users: (MessageUserRow & { role?: string })[];
  endpoints: { userId: string; channel: string; address: string }[];
  /** touchEndpoints の呼び出し(経路・宛先・時刻) */
  endpointTouches: { channel: string; entries: { userId: string; address: string }[]; at: Date }[];
  /** kind のある行 = 種別まるごとの停止(category・channel は '*')。省略・null・'*' = 種別まるごとではない */
  preferences: { userId: string; category: string; channel: string; kind?: string | null }[];
  suppressions: { channel: string; addressHash: string; reason: string; scope: string }[];
  /** 書かれた内部の事件(本物は同じ取引で message_events へ) */
  events: MessageEventRowInsert[];
};

export function createMemoryStore(): MemoryStore {
  const store: MemoryStore = {
    dispatches: [],
    deliveries: [],
    movedKeys: new Set(),
    users: [],
    endpoints: [],
    endpointTouches: [],
    preferences: [],
    suppressions: [],
    events: [],
    async findOptOuts(userIds, category, kind, channels) {
      return store.preferences
        .filter(
          (row) =>
            userIds.includes(row.userId) &&
            ((row.kind ?? "*") === "*" || row.kind === kind) &&
            (row.category === category || row.category === "*") &&
            (channels.includes(row.channel) || row.channel === "*"),
        )
        .map(({ userId, channel }) => ({ userId, channel }));
    },
    async findSuppressions(channel, hashes) {
      return store.suppressions
        .filter((row) => row.channel === channel && hashes.includes(row.addressHash))
        .map(({ addressHash, reason, scope }) => ({ addressHash, reason, scope }));
    },
    async idempotencyKeyExists(key) {
      return store.dispatches.some((row) => row.idempotency_key === key) || store.movedKeys.has(key);
    },
    async insertDispatch(values) {
      if (values.idempotency_key && store.dispatches.some((row) => row.idempotency_key === values.idempotency_key)) {
        throw new MessageIdempotencyConflict();
      }
      const row = { ...values, id: randomUUID() };
      store.dispatches.push(row);
      return { id: row.id };
    },
    async updateDispatch(id, patch, events) {
      const row = store.dispatches.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
      if (events) store.events.push(...events);
    },
    async insertDeliveries(rows: readonly MessageDeliveryInsert[], eventsFor) {
      const created: MessageDelivery[] = [];
      for (const values of rows) {
        const duplicate = store.deliveries.some(
          (row) =>
            row.dispatch_id === values.dispatch_id &&
            row.channel === values.channel &&
            row.recipient_key === values.recipient_key,
        );
        if (duplicate) continue;
        const row = {
          id: randomUUID(),
          user_id: null,
          address: null,
          status: "queued",
          reason: null,
          attempts: 0,
          next_attempt_at: null,
          locked_until: null,
          lock_token: null,
          last_error: null,
          provider: null,
          provider_message_id: null,
          targets: null,
          vars: null,
          body: null,
          sent_at: null,
          delivered_at: null,
          failed_at: null,
          opened_at: null,
          clicked_at: null,
          complained_at: null,
          throttle_key: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...values,
        } as MessageDelivery;
        store.deliveries.push(row);
        created.push({ ...row });
      }
      if (eventsFor) store.events.push(...eventsFor(created));
      return created;
    },
    async updateDelivery(id, patch, events) {
      const row = store.deliveries.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
      if (events) store.events.push(...events);
    },
    async findUsers(ids) {
      return store.users.filter((user) => ids.includes(user.id)).map(({ id, name, email }) => ({ id, name, email }));
    },
    async listUserIds(filter, cursor, limit) {
      const all = store.users
        .filter((user) => !filter.roles || filter.roles.includes(user.role ?? "user"))
        .map((user) => user.id)
        .sort()
        .filter((id) => !cursor || id > cursor);
      const userIds = all.slice(0, limit);
      return { userIds, nextCursor: all.length > limit ? userIds[userIds.length - 1] : null };
    },
    async countUserIds(filter) {
      return store.users.filter((user) => !filter.roles || filter.roles.includes(user.role ?? "user")).length;
    },
    async touchEndpoints(channel, entries, at) {
      store.endpointTouches.push({ channel, entries: [...entries], at });
    },
    async findActiveEndpoints(channel, userIds) {
      return store.endpoints
        .filter((row) => row.channel === channel && userIds.includes(row.userId))
        .map(({ userId, address }) => ({ userId, address }));
    },
  };
  return store;
}

/** テスト用の経路: 宛先ごとに返す結果を behave で決め、受けた束を calls に残す */
export function createTestChannel(
  key = "test",
  behave: (target: ChannelSendTarget, call: number) => ChannelSendResult | "throw" = (target) => ({
    address: target.address,
    kind: "sent",
    provider: "fake",
    providerMessageId: `pm-${target.idempotencyKey}`,
  }),
): MessageChannel & { calls: ChannelSendTarget[][] } {
  const calls: ChannelSendTarget[][] = [];
  return {
    key,
    label: "テスト",
    addressing: "user",
    fields: z.object({ title: z.string(), body: z.string().optional() }).strict(),
    calls,
    async send(targets) {
      calls.push([...targets]);
      const call = calls.length;
      const results: ChannelSendResult[] = [];
      for (const target of targets) {
        const result = behave(target, call);
        if (result === "throw") throw new Error(`boom ${target.content.body ?? ""}`);
        results.push(result);
      }
      return results;
    },
  };
}

export const testConfig: MessagingConfig = {
  smallSendMaxRecipients: 5,
  inRequestBatchSize: 2,
  requiredRetry: { attempts: 3, delaysMs: [1, 1] },
  transientRetry: { maxAttempts: 5, baseDelaySeconds: 60, factor: 4 },
  expandChunkSize: 2,
  channels: { line: { enabled: false } },
  sweep: { budgetMs: 60_000, deliveryChunkSize: 2, expandChunksPerRun: 5, leaseSeconds: 300 },
  retention: { eventsDays: 30, deliveriesDays: 90, dispatchesDays: 730, idempotencyKeyDays: null, chunkSize: 2, budgetMs: 60_000 },
  inbox: { showUnreadModal: false, unreadModalPaths: ["/"] },
  schedule: { maxDaysAhead: 30 },
  subscribers: { lagSeconds: 120, maxAttempts: 3, batchSize: 2, budgetMs: 60_000 },
};

export const FIXED_NOW = new Date("2026-11-10T00:00:00.000Z");

/** テストの種類(種別と経路は種類から引く D81・D86)。テストの定義はこの鍵を category に書く */
export const TEST_CATEGORIES: Readonly<Record<string, MessageCategory>> = {
  news: { key: "news", label: "お知らせ", kind: "marketing", channels: ["test"] },
  account: { key: "account", label: "アカウント", kind: "transactional", channels: ["test"] },
  accountEmail: { key: "accountEmail", label: "アカウント(メール)", kind: "functional", channels: ["email"] },
  newsInApp: { key: "newsInApp", label: "お知らせ(2 経路)", kind: "marketing", channels: ["test", "inApp"] },
  chat: { key: "chat", label: "チャット", kind: "transactional", channels: ["inApp", "mail"] },
  chatMail: { key: "chatMail", label: "チャット(メール)", kind: "transactional", channels: ["mail"] },
  shop: { key: "shop", label: "ショップ", kind: "transactional", channels: ["email", "inApp"] },
  shopEmail: { key: "shopEmail", label: "ショップ(メール)", kind: "transactional", channels: ["email"] },
  marketing: { key: "marketing", label: "キャンペーン情報", kind: "marketing", channels: ["email", "inApp"] },
  operatorDirect: { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "inApp"] },
};

export function createDeps(overrides: Partial<MessageSendDeps> & { store: MemoryStore }): MessageSendDeps & { slept: number[] } {
  const slept: number[] = [];
  return {
    channels: {},
    enrichers: {},
    audiences: {},
    registry: {} satisfies MessageRegistry,
    categories: TEST_CATEGORIES,
    config: testConfig,
    now: () => FIXED_NOW,
    sleep: async (ms) => {
      slept.push(ms);
    },
    context: () => ({ serviceName: "テストサービス", appBaseUrl: "https://example.test" }),
    actor: () => ({ actorId: "admin-1", actorType: "admin" }),
    unsubscribe: {
      configured: () => true,
      url: ({ recipientKey, category, channel }) => `https://example.test/u?r=${recipientKey}&c=${category}&ch=${channel}`,
    },
    slept,
    ...overrides,
  };
}

/** メモリのお知らせの行(間引きのテスト) */
export type MemoryInboxItem = MessageInboxItemInsert & { id: string; read: boolean };

/**
 * メモリの間引きの store(鍵ごとの mutex: 同じ鍵の withKey は前の呼び出しが終わるまで待つ)。
 * 配達の行は送る口のメモリの store(deliveries)を読み書きする。既読は item.read
 */
export function createMemoryThrottleStore(store: MemoryStore): MessageThrottleStore & { items: MemoryInboxItem[] } {
  const items: MemoryInboxItem[] = [];
  const tails = new Map<string, Promise<unknown>>();
  const toRow = (row: MessageDelivery): ThrottleDeliveryRow => ({
    id: row.id,
    dispatch_id: row.dispatch_id,
    channel: row.channel,
    status: row.status,
    reason: row.reason ?? null,
    throttle_key: row.throttle_key ?? null,
    attempts: row.attempts,
  });
  return {
    items,
    async withKey(throttleKey, fn) {
      const before = tails.get(throttleKey) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((resolve) => {
        release = resolve;
      });
      tails.set(throttleKey, before.then(() => mine));
      await before;
      try {
        return await fn({
          async recipientRows(dispatchId, recipientKey) {
            // 取引の中の読みの間に他の処理が動ける(並走のテストで lock が要ることを確かめる)
            await new Promise((resolve) => setImmediate(resolve));
            return store.deliveries
              .filter((row) => row.dispatch_id === dispatchId && row.recipient_key === recipientKey)
              .map(toRow);
          },
          async findUnreadItem(userId, key) {
            const found = items
              .filter((item) => item.user_id === userId && item.throttle_key === key && !item.read)
              .sort((a, b) => b.published_at.getTime() - a.published_at.getTime())[0];
            return found
              ? {
                  id: found.id,
                  dispatch_id: found.dispatch_id,
                  collapsed_count: found.collapsed_count ?? 1,
                  collapsed_dispatch_ids: found.collapsed_dispatch_ids ?? null,
                }
              : null;
          },
          async hasWindowAnchor(key, excludeDispatchId, since) {
            return store.deliveries.some(
              (row) =>
                row.throttle_key === key &&
                row.dispatch_id !== excludeDispatchId &&
                row.reason === null &&
                ((["sent", "delivered"].includes(row.status) && row.sent_at !== null && row.sent_at > since) ||
                  ["queued", "sending"].includes(row.status)),
            );
          },
          async insertItem(row) {
            items.push({ collapsed_count: 1, collapsed_dispatch_ids: null, ...row, id: randomUUID(), read: false });
          },
          async replaceItem(id, patch) {
            const item = items.find((entry) => entry.id === id);
            if (item) Object.assign(item, patch);
          },
          async updateDelivery(id, patch, events) {
            await store.updateDelivery(id, patch, events);
          },
        });
      } finally {
        release();
      }
    },
  };
}
