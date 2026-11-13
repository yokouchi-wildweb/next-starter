// 管理の送信と読む口の検査(DB・送る口・監査は偽物)
// - 管理者の再検査(service): admin の利用者と system は通る、他は 403
// - 一括送信: userIds / target + recordIds、重複を除く、種別(既定 marketing、transactional は明示)、送り元、afterSend(失敗しても送信は戻さない)、監査 1 行
// - 読む口: 絞り込みの検査、keyset の印、DTO(本文は記録の段次第、provider の生の値と誤りの文は出さない、前の送る口の回)
// - 続きを送る: 監査 1 行
// 実行: pnpm test src/features/core/messaging/services/server/admin
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AuditContext, AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import type { SendMessageToManyInput } from "../sendMessage/types";
import { assertAdminActor } from "./assertAdmin";
import { adminBulkSend, type AdminBulkSendDeps } from "./bulkSend";
import { adminContinueSending } from "./continueSending";
import { toDeliveryRow, toDispatchDetail, toDispatchSummary } from "./dispatchDto";
import { operationFlags } from "./operations";
import { decodeCursor, encodeCursor, findDispatch, listDeliveries, listDispatches, type AdminDispatchStore } from "./readDispatches";
import type { MessageBulkSendTarget } from "./types";

const ctx = (actorId: string | null, actorType: AuditContext["actorType"] = "admin") =>
  ({ actorId, actorType, ip: null, userAgent: null, sessionId: null, requestId: "r" }) as AuditContext;
const roles: Record<string, string> = { admin1: "admin", user1: "user" };
const check = (context: AuditContext | null) => ({
  context: () => context,
  roleCategoryOf: async (id: string) => roles[id] ?? null,
});

async function rejects403(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.status === 403);
}

test("管理者の再検査: admin の利用者と system は通り、利用者・文脈なし・知らない id は 403", async () => {
  await assertAdminActor(check(ctx("admin1")));
  await assertAdminActor(check(ctx(null, "system")));
  await rejects403(assertAdminActor(check(ctx("user1", "user"))));
  await rejects403(assertAdminActor(check(ctx("ghost"))));
  await rejects403(assertAdminActor(check(null)));
});

function bulkSetup(options: { context?: AuditContext | null; afterSendFails?: boolean } = {}) {
  const sent: { category: string; input: SendMessageToManyInput }[] = [];
  const audits: AuditRecordInput[] = [];
  const after: unknown[] = [];
  const target: MessageBulkSendTarget = {
    key: "review",
    label: "審査",
    resolveUserIds: async (ids) => ids.map((id) => `u-${id.replace(/\d$/, "")}`),
    afterSend: async (result) => {
      after.push(result);
      if (options.afterSendFails) throw new Error("memo failed");
    },
  };
  const deps: AdminBulkSendDeps = {
    ...check(options.context === undefined ? ctx("admin1") : options.context),
    targets: { review: target, off: { ...target, key: "off", enabled: () => false } },
    sendMessageToMany: async (definition, input) => {
      sent.push({ category: definition.category, input });
      return { dispatchId: "d1", status: "processing", deliveries: [], queuedCount: 3, channelCounts: {} };
    },
    recordAudit: async (input) => audits.push(input),
    serviceNameShort: () => "short",
  };
  return { deps, sent, audits, after };
}

const mail = { channels: ["email"] as ("email" | "inApp")[], email: { subject: "件名", body: "本文" } };

test("一括送信(userIds): 重複を除き adminMessage を marketing で送り、監査 1 行", async () => {
  const { deps, sent, audits } = bulkSetup();
  const result = await adminBulkSend(deps, { userIds: ["a", "b", "a"], ...mail });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].category, "marketing");
  assert.deepEqual(sent[0].input.recipients, [{ userId: "a" }, { userId: "b" }]);
  assert.deepEqual(sent[0].input.vars, { subject: "件名", body: "本文", inAppTitle: "", inAppBody: "", serviceNameShort: "short" });
  assert.equal(sent[0].input.source, "messaging.adminBulk");
  assert.deepEqual(result, { dispatchId: "d1", status: "processing", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 3 }, afterSend: null });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "messaging.dispatch.bulk_sent");
  assert.equal(audits[0].targetId, "d1");
});

test("一括送信(target): 記録 → 利用者、transactional は明示で、afterSend に記録・回・数・中身", async () => {
  const { deps, sent, after, audits } = bulkSetup();
  const result = await adminBulkSend(deps, {
    target: "review",
    recordIds: ["x1", "x2", "y1"],
    kind: "transactional",
    channels: ["email", "inApp"],
    email: { subject: "件名", body: "本文" },
    inApp: { title: "題", body: "お知らせ" },
  });
  // 取引の選択 = 種類 operatorDirect(種別 direct、指令 37 までの仮)
  assert.equal(sent[0].category, "operatorDirect");
  assert.deepEqual(sent[0].input.recipients, [{ userId: "u-x" }, { userId: "u-y" }]);
  assert.equal(sent[0].input.source, "review.bulk");
  assert.deepEqual(after, [
    {
      recordIds: ["x1", "x2", "y1"],
      dispatchId: "d1",
      counts: { recipientCount: 2, channelCounts: {}, queuedCount: 3 },
      content: { email: { subject: "件名", body: "本文" }, inApp: { title: "題", body: "お知らせ" } },
    },
  ]);
  assert.deepEqual(result.afterSend, { ok: true });
  assert.equal((audits[0].metadata as Record<string, unknown>).bulkSendTarget, "review");
});

test("afterSend が投げても送信は戻さず結果と監査に失敗を残す", async () => {
  const { deps, audits } = bulkSetup({ afterSendFails: true });
  const result = await adminBulkSend(deps, { target: "review", recordIds: ["x1"], ...mail });
  assert.deepEqual(result.afterSend, { ok: false, error: "memo failed" });
  assert.deepEqual((audits[0].metadata as Record<string, unknown>).afterSend, { ok: false, error: "memo failed" });
});

test("一括送信の入力の誤り・知らない / 使えない target・管理者でない", async () => {
  const { deps, sent } = bulkSetup();
  const bad = async (input: unknown) =>
    assert.rejects(adminBulkSend(deps, input as never), (e: unknown) => e instanceof DomainError && e.status === 400);
  await bad({ ...mail });
  await bad({ userIds: ["a"], target: "review", recordIds: ["x"], ...mail });
  await bad({ userIds: ["a"], channels: ["email"] });
  await bad({ userIds: ["a"], channels: ["inApp"], email: mail.email });
  await bad({ target: "nope", recordIds: ["x"], ...mail });
  await bad({ target: "off", recordIds: ["x"], ...mail });
  await bad({ userIds: ["a"], ...mail, kind: "activity" });
  assert.equal(sent.length, 0);
  await rejects403(adminBulkSend(bulkSetup({ context: ctx("user1", "user") }).deps, { userIds: ["a"], ...mail }));
});

const dispatchRow = (over: Partial<MessageDispatch> = {}): MessageDispatch =>
  ({
    id: "d1",
    status: "completed",
    idempotency_key: null,
    channels: ["email"],
    recipient_count: 2,
    source: "messaging.adminBulk",
    actor_id: "admin1",
    actor_type: "admin",
    reason: null,
    metadata: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    completed_at: null,
    message_key: "messaging.adminMessage",
    template_id: null,
    template_version: null,
    category: "marketing",
    audience: null,
    tags: null,
    scheduled_at: null,
    channel_counts: null,
    headings: { email: "件名" },
    vars: { subject: "件名" },
    rendered: { email: { subject: "件名" } },
    record: "meta",
    show_to_later_signups: false,
    retracted_at: null,
    expand_cursor: null,
    is_test: false,
    updatedAt: null,
    ...over,
  }) as MessageDispatch;

const deliveryRow = (over: Partial<MessageDelivery> = {}): MessageDelivery =>
  ({
    id: "v1",
    dispatch_id: "d1",
    recipient_key: "user:u1",
    user_id: "u1",
    address: "u1@x",
    channel: "email",
    status: "failed",
    reason: null,
    attempts: 1,
    next_attempt_at: null,
    locked_until: null,
    lock_token: null,
    last_error: "provider said 550 secret detail",
    provider: "resend",
    provider_message_id: "re_raw",
    targets: [{ address: "u1@x", status: "failed", attempts: 1, next_attempt_at: null, provider_message_id: "re_raw", last_error: "x" }],
    vars: { item: "靴" },
    body: { email: { subject: "s" } },
    sent_at: null,
    delivered_at: null,
    failed_at: new Date("2026-11-01T00:00:01Z"),
    opened_at: null,
    clicked_at: null,
    complained_at: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: null,
    ...over,
  }) as MessageDelivery;

const FLAGS = operationFlags({ status: "completed", expand_cursor: null, retracted_at: null, record: "meta", vars: null }, null, {
  failed: 0,
  unknown: 0,
});

test("DTO: 本文は記録の段次第、provider の生の値と誤りの文は出さない、前の送る口の回は段に依らず rendered", () => {
  assert.equal(toDispatchDetail(dispatchRow(), FLAGS).body, null);
  assert.equal(toDispatchDetail(dispatchRow(), FLAGS).vars, null);
  assert.deepEqual(toDispatchDetail(dispatchRow({ record: "vars" }), FLAGS).body, { email: { subject: "件名" } });
  const oldSend = toDispatchDetail(
    dispatchRow({ message_key: null, record: null, headings: { email: "旧件名" }, rendered: { email: { subject: "旧件名", paragraphs: ["旧本文"] } } }),
    FLAGS,
  );
  assert.deepEqual(oldSend.headings, { email: "旧件名" });
  assert.deepEqual(oldSend.body, { email: { subject: "旧件名", paragraphs: ["旧本文"] } });
  assert.deepEqual(toDispatchSummary(dispatchRow({ headings: null })).headings, {});
  assert.equal(toDispatchSummary(dispatchRow()).createdAt, "2026-11-01T00:00:00.000Z");

  const meta = toDeliveryRow(deliveryRow(), "meta");
  const text = JSON.stringify(meta);
  assert.ok(!text.includes("re_raw") && !text.includes("secret detail"));
  assert.deepEqual(meta.targets, [{ address: "u1@x", status: "failed", attempts: 1 }]);
  assert.equal(meta.address, "u1@x");
  assert.deepEqual([meta.vars, meta.body], [null, null]);
  assert.deepEqual(toDeliveryRow(deliveryRow(), "vars").vars, { item: "靴" });
  assert.equal(toDeliveryRow(deliveryRow(), "vars").body, null);
  assert.deepEqual(toDeliveryRow(deliveryRow(), "full").body, { email: { subject: "s" } });

  // 失敗の理由の符号: last_error の符号の部分だけ(provider の文は出さない)。形の違う文・送れた行は null
  assert.equal(meta.errorCode, null);
  const keyMissing = toDeliveryRow(deliveryRow({ status: "failed", last_error: "unsubscribe_key_missing: 鍵がありません" }), "meta");
  assert.equal(keyMissing.errorCode, "unsubscribe_key_missing");
  assert.ok(!JSON.stringify(keyMissing).includes("鍵がありません"));
  assert.equal(toDeliveryRow(deliveryRow({ status: "failed", last_error: "send_threw" }), "meta").errorCode, "send_threw");
  assert.equal(toDeliveryRow(deliveryRow({ status: "sent", last_error: "send_threw" }), "meta").errorCode, null);
  assert.equal(toDeliveryRow(deliveryRow({ status: "failed", last_error: null }), "meta").errorCode, null);
});

test("keyset の印は往復し、壊れた印は 400", () => {
  const at = new Date("2026-11-01T00:00:00Z");
  assert.deepEqual(decodeCursor(encodeCursor({ createdAt: at, id: "d9" })), { createdAt: at, id: "d9" });
  assert.throws(() => decodeCursor("zzz"), (e: unknown) => e instanceof DomainError && e.status === 400);
});

test("読む口: 1 件多く引いて次の印を作る、絞り込みを store へ、配達は回の記録の段で絞る、管理者だけ", async () => {
  const seen: unknown[] = [];
  const rows = [dispatchRow({ id: "d3" }), dispatchRow({ id: "d2" }), dispatchRow({ id: "d1" })];
  const store: AdminDispatchStore = {
    listDispatches: async (filter, after, limit) => {
      seen.push({ filter, after, limit });
      return rows.slice(0, limit);
    },
    findDispatch: async (id) => (id === "d1" ? dispatchRow({ record: "vars" }) : null),
    listDeliveries: async (_id, filter, after, limit) => {
      seen.push({ filter, after, limit });
      return [deliveryRow()];
    },
  };
  const operationInputs = async () => ({ policy: null, counts: { failed: 0, unknown: 0 } });
  const deps = { ...check(ctx("admin1")), dispatchStore: store, operationInputs };
  const first = await listDispatches(deps, { limit: "2", kind: "marketing", channel: "email" } as never);
  assert.deepEqual(first.items.map((item) => item.id), ["d3", "d2"]);
  assert.ok(first.nextCursor);
  assert.deepEqual(seen[0], { filter: { kind: "marketing", channel: "email" }, after: null, limit: 3 });
  await listDispatches(deps, { cursor: first.nextCursor! });
  assert.deepEqual((seen[1] as { after: unknown }).after, { createdAt: rows[1].createdAt, id: "d2" });
  await assert.rejects(listDispatches(deps, { status: "nope" } as never), (e: unknown) => e instanceof DomainError && e.status === 400);

  const deliveries = await listDeliveries(deps, "d1", { status: "failed" });
  assert.deepEqual(deliveries.items[0].vars, { item: "靴" });
  assert.equal(deliveries.nextCursor, null);
  await assert.rejects(findDispatch(deps, "nope"), (e: unknown) => e instanceof DomainError && e.status === 404);
  await assert.rejects(listDeliveries(deps, "nope"), (e: unknown) => e instanceof DomainError && e.status === 404);
  assert.equal((await findDispatch(deps, "d1")).operations.retract.allowed, true);
  await rejects403(listDispatches({ ...check(ctx("user1", "user")), dispatchStore: store, operationInputs }));
});

test("続きを送る: 進めて監査 1 行、管理者でなければ 403", async () => {
  const audits: AuditRecordInput[] = [];
  const result = { expanded: false, claimed: 2, sent: 2, failed: 0, completed: true };
  const deps = { ...check(ctx("admin1")), continueSending: async () => result, recordAudit: async (input: AuditRecordInput) => audits.push(input) };
  assert.deepEqual(await adminContinueSending(deps, "d1"), result);
  assert.deepEqual([audits[0].action, audits[0].targetId], ["messaging.dispatch.continued", "d1"]);
  await rejects403(adminContinueSending({ ...deps, ...check(ctx("user1", "user")) }, "d1"));
});
