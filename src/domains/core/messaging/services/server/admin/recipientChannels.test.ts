// 受け取れる送信チャンネルの口(recipientChannels.ts)の検査。宛先・停止は偽物(送る口の物を渡す所だけ見る)
// - 理由ごと: channel_off(項目なし・enabled: false)/ no_address / preference / suppression / 受け取れる
// - 条件: category = そのカテゴリーの送信チャンネルと停止の文脈 / message = 定義の送信チャンネルと required / 無し = 受け口の全部・カテゴリーなし
// - 404: 無い利用者・読めない連絡定義、400: 知らないカテゴリー・両方の指定、403: 管理者でない
// 実行: pnpm test src/domains/core/messaging/services/server/admin/recipientChannels.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AuditContext } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import type { MessageCategory, MessageChannel } from "@/lib/messaging";

import type { StopContext, StopTarget } from "../sendMessage/stops";
import { recipientChannels, type RecipientChannelsDefinition, type RecipientChannelsDeps } from "./recipientChannels";

const ctx = (actorId: string) =>
  ({ actorId, actorType: actorId === "admin1" ? "admin" : "user", ip: null, userAgent: null, sessionId: null, requestId: "r" }) as AuditContext;
const roles: Record<string, string> = { admin1: "admin", user1: "user" };

const channel = (key: string, patch: Partial<MessageChannel> = {}) => ({ key, label: key, addressing: "user", send: async () => [], ...patch }) as MessageChannel;

const CATEGORIES: Record<string, MessageCategory> = {
  campaign: { key: "campaign", label: "キャンペーン", kind: "promotion", channels: ["email", "inApp"] },
};

/** 宛先: u1 は email・inApp・line・push を持つ、u2 は inApp だけ */
const ADDRESSES: Record<string, Record<string, string[]>> = {
  u1: { email: ["a@example.com"], inApp: ["u1"], line: ["L1"], push: ["T1"] },
  u2: { inApp: ["u2"] },
};

function makeDeps(options: { actor?: string; stopped?: Record<string, "preference" | "suppression">; definitions?: Record<string, RecipientChannelsDefinition> } = {}) {
  const stopCalls: { context: StopContext; targets: StopTarget[] }[] = [];
  const deps: RecipientChannelsDeps = {
    context: () => ctx(options.actor ?? "admin1"),
    roleCategoryOf: async (id) => roles[id] ?? null,
    userExists: async (id) => id in ADDRESSES,
    categories: CATEGORIES,
    channels: { email: channel("email"), inApp: channel("inApp"), line: channel("line", { enabled: false }), push: channel("push") },
    loadDefinition: async (key) => options.definitions?.[key] ?? null,
    resolveAddresses: async (key, _channel, userIds) =>
      new Map(userIds.flatMap((id) => (ADDRESSES[id]?.[key] ? [[id, ADDRESSES[id]![key]!] as [string, string[]]] : []))),
    checkStops: async (context, targets) => {
      stopCalls.push({ context, targets: [...targets] });
      return targets.map((target) => {
        const reason = options.stopped?.[target.channel];
        return reason ? { stopped: true as const, reason } : { stopped: false as const, addresses: target.addresses };
      });
    },
  };
  return { deps, stopCalls };
}

const status = (code: number) => (error: unknown) => error instanceof DomainError && error.status === code;

test("条件なし: 受け口の全部の送信チャンネル、enabled: false は channel_off、停止はカテゴリーなしの文脈で", async () => {
  const { deps, stopCalls } = makeDeps();
  const result = await recipientChannels(deps, "u1");
  assert.deepEqual(result, {
    email: { available: true },
    inApp: { available: true },
    line: { available: false, reason: "channel_off" },
    push: { available: true },
  });
  assert.deepEqual(stopCalls[0]!.context, { kind: null, required: false, category: null });
  assert.deepEqual(stopCalls[0]!.targets.map((t) => [t.channel, t.recipientKey, t.addresses]), [
    ["email", "user:u1", ["a@example.com"]],
    ["inApp", "user:u1", ["u1"]],
    ["push", "user:u1", ["T1"]],
  ], "宛先の無い・切の送信チャンネルは停止を見ない");
});

test("no_address: 宛先の無い送信チャンネル(メールアドレスなし・未連携は送信チャンネルの鍵で分かる)", async () => {
  const { deps } = makeDeps();
  const result = await recipientChannels(deps, "u2", { category: "campaign" });
  assert.deepEqual(result, { email: { available: false, reason: "no_address" }, inApp: { available: true } });
});

test("category: カテゴリーの送信チャンネルだけ、停止の文脈 = 種別とカテゴリー(required なし)、preference と suppression", async () => {
  const { deps, stopCalls } = makeDeps({ stopped: { email: "suppression", inApp: "preference" } });
  const result = await recipientChannels(deps, "u1", { category: "campaign" });
  assert.deepEqual(result, {
    email: { available: false, reason: "suppression" },
    inApp: { available: false, reason: "preference" },
  });
  assert.deepEqual(stopCalls[0]!.context, { kind: "promotion", required: false, category: "campaign" });
});

test("message: 定義の送信チャンネルと required(上書きの後の値)を停止の文脈へ", async () => {
  const definitions = { "shop.notice": { kind: "promotion", required: true, category: "campaign", channels: ["inApp", "push"] } as RecipientChannelsDefinition };
  const { deps, stopCalls } = makeDeps({ definitions });
  const result = await recipientChannels(deps, "u1", { message: "shop.notice" });
  assert.deepEqual(result, { inApp: { available: true }, push: { available: true } });
  assert.deepEqual(stopCalls[0]!.context, { kind: "promotion", required: true, category: "campaign" });
});

test("404: 無い利用者・読めない連絡定義、400: 知らないカテゴリー・両方の指定、403: 管理者でない", async () => {
  const { deps } = makeDeps();
  await assert.rejects(recipientChannels(deps, "nobody"), status(404));
  await assert.rejects(recipientChannels(deps, "u1", { message: "nope.x" }), status(404));
  await assert.rejects(recipientChannels(deps, "u1", { category: "nope" }), status(400));
  await assert.rejects(recipientChannels(deps, "u1", { category: "campaign", message: "shop.notice" }), status(400));
  await assert.rejects(recipientChannels(makeDeps({ actor: "user1" }).deps, "u1"), status(403));
});
