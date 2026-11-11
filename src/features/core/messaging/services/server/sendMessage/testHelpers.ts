// src/features/core/messaging/services/server/sendMessage/testHelpers.ts
//
// 送る口の単体テストの部品: メモリの store とテスト用の経路の項目(上流の経路の項目はまだ 0 本)。テストだけが読む。

import { randomUUID } from "node:crypto";

import { z } from "zod";

import type {
  ChannelSendResult,
  ChannelSendTarget,
  MessageChannel,
  MessageRegistry,
} from "@/lib/messaging";

import type { MessagingConfig } from "../../../config";
import type { MessageDelivery, MessageDeliveryInsert, MessageDispatchInsert } from "../../../entities/model";
import { MessageIdempotencyConflict } from "./errors";
import type { MessageSendDeps, MessageSendStore, MessageUserRow } from "./types";

export type MemoryStore = MessageSendStore & {
  dispatches: (MessageDispatchInsert & { id: string })[];
  deliveries: MessageDelivery[];
  movedKeys: Set<string>;
  users: (MessageUserRow & { role?: string })[];
  endpoints: { userId: string; channel: string; address: string }[];
  /** touchEndpoints の呼び出し(経路・宛先・時刻) */
  endpointTouches: { channel: string; entries: { userId: string; address: string }[]; at: Date }[];
  preferences: { userId: string; category: string; channel: string }[];
  suppressions: { channel: string; addressHash: string; reason: string; scope: string }[];
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
    async findOptOuts(userIds, category, channels) {
      return store.preferences
        .filter(
          (row) =>
            userIds.includes(row.userId) &&
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
    async updateDispatch(id, patch) {
      const row = store.dispatches.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
    },
    async insertDeliveries(rows: readonly MessageDeliveryInsert[]) {
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
          createdAt: new Date(),
          updatedAt: new Date(),
          ...values,
        } as MessageDelivery;
        store.deliveries.push(row);
        created.push({ ...row });
      }
      return created;
    },
    async updateDelivery(id, patch) {
      const row = store.deliveries.find((item) => item.id === id);
      if (row) Object.assign(row, patch);
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
};

export const FIXED_NOW = new Date("2026-11-10T00:00:00.000Z");

export function createDeps(overrides: Partial<MessageSendDeps> & { store: MemoryStore }): MessageSendDeps & { slept: number[] } {
  const slept: number[] = [];
  return {
    channels: {},
    enrichers: {},
    audiences: {},
    registry: {} satisfies MessageRegistry,
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
