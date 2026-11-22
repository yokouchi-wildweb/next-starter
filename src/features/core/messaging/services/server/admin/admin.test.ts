// 管理の送信と読む口の検査(DB・送る口・監査は偽物)
// - 管理者の再検査(service): admin の利用者と system は通る、他は 403
// - 一括送信: userIds / target + recordIds、重複を除く、中身は送る画面と同じ { origin, values, edited?, vars? }(D117・D171、専用の値は vars 指令 58)を送る口 sendFreeMessage へ、
//   カテゴリー(必須、bulk で送れる種別 direct・promotion だけ)、送り元、記録の宛先は利用者を解くだけ(afterSend は呼ばない)、監査 1 行、選択肢
// - DTO の前の送る口の送信 = レイアウト(layout)が無い送信。自由連絡の送信(message_key null)は前の送信ではない
// - 読む口: 絞り込みの検査、keyset の印、DTO(本文は記録の段次第、provider の生の値と誤りの文は出さない、前の送る口の送信)
// - グループ宛ての送信: 一覧・1 件に宛先のグループ { id(値だけ), name }、名前は 1 ページに 1 回引く、引けなければ null、detail.target は形だけ
// - 続きを送る: 監査 1 行
// 実行: pnpm test src/features/core/messaging/services/server/admin
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AuditContext, AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import { assertAdminActor } from "./assertAdmin";
import type { MessageCategory, MessageChannel, MessageRecordTarget, MessageSource } from "@/lib/messaging";
import { sourceLabelOf } from "./sourceLabels";

import { adminBulkSend, adminBulkSendOptions, adminBulkSendPreview, adminBulkSendTest, type AdminBulkSendDeps } from "./bulkSend";
import { adminContinueSending } from "./continueSending";
import { toDeliveryRow, toDispatchDetail, toDispatchSummary } from "./dispatchDto";
import { operationFlags } from "./operations";
import { decodeCursor, dispatchCategoryOptions, encodeCursor, findDispatch, listDeliveries, listDispatches, type AdminDispatchStore } from "./readDispatches";
import { TEST_LAYOUTS } from "../sendMessage/testHelpers";

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

const bulkCategories: Record<string, MessageCategory> = {
  announcement: { key: "announcement", label: "運営からのお知らせ", kind: "announcement", channels: ["email", "inApp"] },
  operatorDirect: { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "inApp"] },
  promotion: { key: "promotion", label: "キャンペーン情報", kind: "promotion", channels: ["email", "inApp"] },
  promoPush: { key: "promoPush", label: "プッシュ", kind: "promotion", channels: ["email", "push"] },
};

const TEMPLATE = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_VALUES = { subject: "{{name}} 様へ", blocks: [{ type: "paragraph", text: "本文" }] };
/** 公開中のテンプレートの選択肢(今の版の レイアウト・欄の中身・専用の宣言) */
const tplRow = {
  id: TEMPLATE,
  key: "t",
  name: "T",
  category: "promotion",
  currentVersion: 2,
  layout: "notice",
  layoutVersion: 1,
  values: TEMPLATE_VALUES,
  vars: [{ key: "name", alias: "お名前", type: "line" as const, required: true }],
};

function bulkSetup(options: { context?: AuditContext | null; templatesOpen?: boolean } = {}) {
  const sent: Record<string, unknown>[] = [];
  const calls: { fn: string; args: unknown[] }[] = [];
  const audits: AuditRecordInput[] = [];
  const after: unknown[] = [];
  const target: MessageRecordTarget = {
    key: "review",
    label: "審査",
    messages: [],
    // 記録 x1・x2 → 利用者 u-x(1 人 1 件にまとめる)、y1 → u-y
    resolveRecipients: async (ids) => {
      const byUser = new Map<string, string[]>();
      for (const id of ids) byUser.set(`u-${id.replace(/\d$/, "")}`, [...(byUser.get(`u-${id.replace(/\d$/, "")}`) ?? []), id]);
      return [...byUser].map(([userId, recordIds]) => ({ userId, vars: {}, recordIds }));
    },
    // 自由連絡の一括送信は呼ばない(呼ばれたら after に残る)
    afterSend: async (result) => {
      after.push(result);
    },
  };
  const deps: AdminBulkSendDeps = {
    ...check(options.context === undefined ? ctx("admin1") : options.context),
    // 読み手(門番 loadRecordTarget)の代わり: 無い鍵・閉じた・enabled() が false はどれも null
    recordTarget: async (key) => (key === "review" ? target : null),
    channels: {
      email: { key: "email", label: "メール" } as unknown as MessageChannel,
      inApp: { key: "inApp", label: "お知らせ" } as unknown as MessageChannel,
      line: { key: "line", label: "LINE", enabled: false } as unknown as MessageChannel,
    },
    categories: bulkCategories,
    layouts: TEST_LAYOUTS,
    enrichers: {},
    sendFreeMessage: async (input) => {
      sent.push(input as unknown as Record<string, unknown>);
      return "id" in input.origin
        ? { dispatchId: "d2", status: "processing", deliveries: [], queuedCount: 1, channelCounts: {}, template: { id: TEMPLATE, version: 2, edited: true } }
        : { dispatchId: "d1", status: "processing", deliveries: [], queuedCount: 3, channelCounts: {} };
    },
    previewMessage: async (...args) => {
      calls.push({ fn: "preview", args });
      return { messageKey: "messaging.template", kind: "promotion", category: "promotion", template: null, channels: [] };
    },
    recordAudit: async (input) => audits.push(input),
    listPublishedTemplates: async () => [tplRow],
    templatesOpen: () => options.templatesOpen ?? true,
    initialLayout: () => "notice",
  };
  return { deps, sent, audits, after, calls };
}

const MAIL = { subject: "件名", blocks: [{ type: "paragraph", text: "本文" }] };
/** レイアウトを直に選んだ出どころ(notice は管理画面で選べる) */
const LAYOUT = { layout: "notice" };
const mail = { category: "promotion", channels: ["email"], origin: LAYOUT, values: MAIL };

test("一括送信(userIds): 重複を除き送る口にレイアウト・欄の中身・カテゴリー、監査 1 行", async () => {
  const { deps, sent, audits } = bulkSetup();
  const result = await adminBulkSend(deps, { userIds: ["a", "b", "a"], ...mail });
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].category, sent[0].origin, sent[0].values, sent[0].channels], ["promotion", LAYOUT, MAIL, ["email"]]);
  assert.deepEqual(sent[0].recipients, [{ userId: "a" }, { userId: "b" }]);
  assert.equal(sent[0].source, "messaging.adminBulk");
  assert.deepEqual(result, { dispatchId: "d1", status: "processing", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 3 } });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "messaging.dispatch.bulk_sent");
  assert.equal(audits[0].targetId, "d1");
  assert.deepEqual(
    [audits[0].metadata?.source, audits[0].metadata?.layout, audits[0].metadata?.category, audits[0].metadata?.kind],
    ["layout", "notice", "promotion", "promotion"],
  );
});

test("一括送信(target): 記録 → 利用者、運営からのご連絡(direct)で、項目の afterSend は呼ばない(定義の送信だけ、D196)", async () => {
  const { deps, sent, after, audits } = bulkSetup();
  const values = { ...MAIL, blocks: [...MAIL.blocks, { type: "paragraph", text: "お知らせ" }] };
  const result = await adminBulkSend(deps, {
    target: "review",
    recordIds: ["x1", "x2", "y1"],
    category: "operatorDirect",
    channels: ["email", "inApp"],
    origin: LAYOUT,
    values,
  });
  assert.equal(sent[0].category, "operatorDirect");
  assert.deepEqual(sent[0].recipients, [{ userId: "u-x" }, { userId: "u-y" }]);
  assert.equal(sent[0].source, "review.bulk");
  assert.deepEqual(after, []);
  assert.deepEqual(result.counts, { recipientCount: 2, channelCounts: {}, queuedCount: 3 });
  assert.equal((audits[0].metadata as Record<string, unknown>).recordTarget, "review");
  assert.equal("afterSend" in (audits[0].metadata as Record<string, unknown>), false);
});

test("一括送信の入力の誤り・知らない / 使えない target・管理者でない", async () => {
  const { deps, sent } = bulkSetup();
  const bad = async (input: unknown) =>
    assert.rejects(adminBulkSend(deps, input as never), (e: unknown) => e instanceof DomainError && e.status === 400);
  await bad({ ...mail });
  await bad({ userIds: ["a"], target: "review", recordIds: ["x"], ...mail });
  await bad({ userIds: ["a"], category: "promotion", channels: ["email"] });
  // 前の形(送信チャンネルごとの content・message の包み・email を上に)と予約は 400
  await bad({ userIds: ["a"], category: "promotion", channels: ["email"], content: { email: { subject: "s" } } });
  await bad({ userIds: ["a"], category: "promotion", message: { type: "adhoc", email: { subject: "s", body: "b" } } });
  await bad({ userIds: ["a"], category: "promotion", channels: ["email"], email: { subject: "s", body: "b" } });
  await bad({ userIds: ["a"], ...mail, scheduledAt: "2026-12-01T00:00:00Z" });
  await bad({ target: "nope", recordIds: ["x"], ...mail });
  await bad({ target: "off", recordIds: ["x"], ...mail });
  await bad({ userIds: ["a"], ...mail, kind: "promotion" });
  await bad({ userIds: ["a"], ...mail, category: undefined });
  // announcement は一覧の一括(bulk)で送れない
  await bad({ userIds: ["a"], ...mail, category: "announcement" });
  await bad({ userIds: ["a"], ...mail, category: "nope" });
  // 廃止したシステムテンプレートの出どころ・前の鍵 template は 400(D171)。レイアウトでの直した印も 400
  await bad({ userIds: ["a"], ...mail, origin: { system: "promotion" } });
  await bad({ userIds: ["a"], category: "promotion", channels: ["email"], template: LAYOUT, values: MAIL });
  await bad({ userIds: ["a"], ...mail, edited: true });
  assert.equal(sent.length, 0);
  await rejects403(adminBulkSend(bulkSetup({ context: ctx("user1", "user") }).deps, { userIds: ["a"], ...mail }));
});

test("一括送信(DB のテンプレート): 送る画面と同じ形で送る口へ、afterSend に送った欄の中身と出どころ(直した印)", async () => {
  const { deps, after, audits, sent } = bulkSetup();
  const result = await adminBulkSend(deps, {
    target: "review",
    recordIds: ["x1"],
    category: "promoPush",
    origin: { id: TEMPLATE, version: 2 },
    values: TEMPLATE_VALUES,
    vars: { name: "春" },
  });
  const input = sent[0];
  assert.deepEqual(
    [input.origin, input.values, input.vars, input.category, input.recipients, input.source],
    [{ id: TEMPLATE, version: 2 }, TEMPLATE_VALUES, { name: "春" }, "promoPush", [{ userId: "u-x" }], "review.bulk"],
  );
  assert.equal("scheduledAt" in input, false);
  assert.equal(result.dispatchId, "d2");
  assert.deepEqual((after[0] as Record<string, unknown>).values, TEMPLATE_VALUES);
  assert.deepEqual((after[0] as Record<string, unknown>).origin, { id: TEMPLATE, version: 2, edited: true });
  assert.deepEqual([audits[0].metadata?.source, audits[0].metadata?.templateVersion], ["template", 2]);
  assert.equal(audits[0].metadata?.edited, true);
});

test("一括送信のプレビュー・テスト送信: bulk で送れるカテゴリー、テストは操作した管理者へ is_test", async () => {
  const { deps, calls, sent, audits } = bulkSetup();
  await adminBulkSendPreview(deps, { origin: LAYOUT, values: MAIL, category: "promotion", channels: ["email"] });
  assert.equal(calls[0].fn, "preview");
  assert.deepEqual(calls[0].args, [
    { free: { origin: LAYOUT, values: MAIL, category: "promotion" } },
    { vars: {}, channels: ["email"], userId: "admin1" },
  ]);
  await adminBulkSendTest(deps, { origin: LAYOUT, values: MAIL, category: "operatorDirect", channels: ["email"] });
  assert.deepEqual(sent[0].recipients, [{ userId: "admin1" }]);
  assert.equal(sent[0].isTest, true);
  assert.equal(sent[0].source, "messaging.adminBulk.test");
  assert.equal(audits.at(-1)?.action, "messaging.dispatch.test_sent");
  // announcement は一括で送れないのでプレビュー・テストも 400
  for (const run of [
    adminBulkSendPreview(deps, { origin: LAYOUT, values: MAIL, category: "announcement" }),
    adminBulkSendTest(deps, { origin: LAYOUT, values: MAIL, category: "announcement" }),
  ]) {
    await assert.rejects(run, (e: unknown) => e instanceof DomainError && e.status === 400);
  }
  await rejects403(adminBulkSendPreview(bulkSetup({ context: ctx("user1", "user") }).deps, { origin: LAYOUT, values: MAIL, category: "promotion" }));
});

test("一括送信の選択肢: bulk で送れるカテゴリー、管理画面で選べるレイアウト、テンプレートは門 messagingTemplates が開の時だけ、管理者でなければ 403", async () => {
  const { deps } = bulkSetup();
  const options = await adminBulkSendOptions(deps);
  // 送信チャンネルは送るモーダルと同じ形(受け口の label・閉じた送信チャンネルは出さない。D83)
  assert.deepEqual(options.channels, [
    { key: "email", label: "メール" },
    { key: "inApp", label: "お知らせ" },
  ]);
  assert.deepEqual(options.categories.map((o) => o.key), ["operatorDirect", "promotion", "promoPush"]);
  // レイアウト = 管理画面で選べる物(notice、テンプレートが使うのも notice なので重ねない)
  assert.deepEqual(
    options.layouts.map((o) => [o.key, o.selectable]),
    [["notice", true]],
  );
  assert.deepEqual(options.templates, [tplRow]);
  assert.equal(options.initialLayout, "notice");
  assert.deepEqual((await adminBulkSendOptions(bulkSetup({ templatesOpen: false }).deps)).templates, []);
  await rejects403(adminBulkSendOptions(bulkSetup({ context: ctx("user1", "user") }).deps));
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
    template_edited: false,
    edited_fields: null,
    layout: "notice",
    layout_version: 1,
    values: null,
    category: "promotion",
    target: null,
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

const FLAGS = operationFlags({ status: "completed", deleted_at: null, record: "meta", vars: null, values: null }, null, {
  failed: 0,
  unknown: 0,
});

test("DTO: 本文は記録の段次第、provider の生の値と誤りの文は出さない、前の送る口の送信は段に依らず rendered", () => {
  assert.equal(toDispatchDetail(dispatchRow(), FLAGS).body, null);
  assert.equal(toDispatchDetail(dispatchRow(), FLAGS).vars, null);
  assert.deepEqual(toDispatchDetail(dispatchRow({ record: "vars" }), FLAGS).body, { email: { subject: "件名" } });
  const oldSend = toDispatchDetail(
    dispatchRow({ message_key: null, layout: null, layout_version: null, record: null, headings: { email: "旧件名" }, rendered: { email: { subject: "旧件名", paragraphs: ["旧本文"] } } }),
    FLAGS,
  );
  assert.deepEqual(oldSend.headings, { email: "旧件名" });
  assert.deepEqual(oldSend.body, { email: { subject: "旧件名", paragraphs: ["旧本文"] } });
  // 自由連絡の送信(message_key null、レイアウトあり)は前の送信ではない: 本文は記録の段次第。システムテンプレートの項目は無い(D171)
  const fromTemplate = toDispatchDetail(dispatchRow({ message_key: null }), FLAGS);
  assert.equal(fromTemplate.body, null);
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

test("DTO sameAs: 「同じ内容で送る」の写しは自由連絡で中身を残した送信だけ(定義連絡・前の送信・中身なしは null、D193)", () => {
  const values = { subject: "件名" };
  // 定義連絡の送信: 中身(プレビュー用の content)はあっても写しは答えない
  const definition = toDispatchDetail(dispatchRow({ values, record: "vars" }), FLAGS);
  assert.deepEqual(definition.content, { layout: "notice", layoutVersion: 1, values });
  assert.equal(definition.sameAs, null);
  // レイアウトを直に選んだ自由連絡: テンプレートの出どころは null、値は記録の段が残す時だけ
  const layoutSend = toDispatchDetail(dispatchRow({ message_key: null, values, record: "vars", vars: { a: "1" } }), FLAGS);
  assert.deepEqual(layoutSend.sameAs, { layout: "notice", layoutVersion: 1, values, vars: { a: "1" }, template: null });
  assert.deepEqual(toDispatchDetail(dispatchRow({ message_key: null, values, vars: { a: "1" } }), FLAGS).sameAs?.vars, {}, "meta は値を写さない");
  // DB のテンプレートの送信(消されたテンプレートは id null で版の番号は残る)
  const fromTemplate = toDispatchDetail(
    dispatchRow({ message_key: null, values, record: "vars", vars: { discount: "30" }, template_id: null, template_version: 2, template_edited: true }),
    FLAGS,
  );
  assert.deepEqual(fromTemplate.sameAs, { layout: "notice", layoutVersion: 1, values, vars: { discount: "30" }, template: { id: null, version: 2, edited: true } });
  // 中身を残していない送信・前の送る口の送信(レイアウトなし)
  assert.equal(toDispatchDetail(dispatchRow({ message_key: null }), FLAGS).sameAs, null);
  assert.equal(toDispatchDetail(dispatchRow({ message_key: null, layout: null, values }), FLAGS).sameAs, null);
});

test("keyset の印は往復し、壊れた印は 400", () => {
  const at = new Date("2026-11-01T00:00:00Z");
  assert.deepEqual(decodeCursor(encodeCursor({ createdAt: at, id: "d9" })), { createdAt: at, id: "d9" });
  assert.throws(() => decodeCursor("zzz"), (e: unknown) => e instanceof DomainError && e.status === 400);
});

test("読む口: 1 件多く引いて次の印を作る、絞り込みを store へ、配達は送信の記録の段で絞る、管理者だけ", async () => {
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
    listDispatchUserIds: async () => [],
    userNames: async (ids) => new Map(ids.filter((id) => id === "u1").map((id) => [id, "山田"])),
  };
  const operationInputs = async () => ({ policy: null, counts: { failed: 0, unknown: 0 } });
  const deps = { ...check(ctx("admin1")), dispatchStore: store, operationInputs, sourceLabel: async () => null };
  const first = await listDispatches(deps, { limit: "2", kind: "promotion", category: "campaign", channel: "email", messageKey: "messaging.x" } as never);
  assert.deepEqual(first.items.map((item) => item.id), ["d3", "d2"]);
  assert.ok(first.nextCursor);
  assert.deepEqual(seen[0], { filter: { kind: "promotion", category: "campaign", channel: "email", deleted: "exclude" }, after: null, limit: 3 }, "定義の鍵では絞らない(落とす)。削除した送信は既定で出さない(D88)");
  await listDispatches(deps, { cursor: first.nextCursor! });
  assert.deepEqual((seen[1] as { after: unknown }).after, { createdAt: rows[1].createdAt, id: "d2" });
  await assert.rejects(listDispatches(deps, { status: "nope" } as never), (e: unknown) => e instanceof DomainError && e.status === 400);

  const deliveries = await listDeliveries(deps, "d1", { status: "failed" });
  assert.deepEqual(deliveries.items[0].vars, { item: "靴" });
  assert.equal(deliveries.items[0].userName, "山田", "利用者の名前を 1 ページに 1 回引く");
  assert.equal(deliveries.nextCursor, null);
  await assert.rejects(findDispatch(deps, "nope"), (e: unknown) => e instanceof DomainError && e.status === 404);
  await assert.rejects(listDeliveries(deps, "nope"), (e: unknown) => e instanceof DomainError && e.status === 404);
  assert.equal((await findDispatch(deps, "d1")).operations.canDelete.allowed, true);
  await rejects403(listDispatches({ ...check(ctx("user1", "user")), dispatchStore: store, operationInputs, sourceLabel: async () => null }));
});

test("送信 1 件: 送信の中身(レイアウト・版・欄の中身)と、選んだ利用者への送信の利用者 id(送信の一覧 → 配達の行、多すぎ・ほかの形は null)", async () => {
  const userIdCalls: unknown[] = [];
  let fromDeliveries: string[] = ["u1", "u2"];
  const rows: Record<string, MessageDispatch> = {
    edited: dispatchRow({ id: "edited", template_id: "t1", template_version: 2, template_edited: true, layout: "notice", layout_version: 1, values: { subject: "直した" } } as never),
    plain: dispatchRow({ id: "plain", template_id: "t1", template_version: 2, template_edited: false, layout: "notice", values: null } as never),
    listed: dispatchRow({ id: "listed", target: { type: "recipients", recipients: [{ userId: "a" }, { userId: "b" }, { userId: "a" }] } as never }),
    counted: dispatchRow({ id: "counted", target: { type: "recipients", count: 2 } as never }),
    role: dispatchRow({ id: "role", target: { type: "role", roles: ["user"] } as never }),
  };
  const store: AdminDispatchStore = {
    listDispatches: async () => [],
    findDispatch: async (id) => rows[id] ?? null,
    listDeliveries: async () => [],
    listDispatchUserIds: async (id, limit) => {
      userIdCalls.push([id, limit]);
      return fromDeliveries;
    },
    userNames: async (ids) => new Map(ids.filter((id) => id === "admin1").map((id) => [id, "管理者 A"])),
  };
  const deps = {
    ...check(ctx("admin1")),
    dispatchStore: store,
    operationInputs: async () => ({ policy: null, counts: { failed: 0, unknown: 0 } }),
    sourceLabel: async (source: string) => (source === "messaging.adminBulk" ? "管理者の一括送信" : null),
  };
  const edited = await findDispatch(deps, "edited");
  assert.deepEqual([edited.templateEdited, edited.content], [true, { layout: "notice", layoutVersion: 1, values: { subject: "直した" } }]);
  const plain = await findDispatch(deps, "plain");
  assert.deepEqual([plain.templateEdited, plain.content, plain.targetUserIds], [false, null, null]);
  assert.deepEqual((await findDispatch(deps, "listed")).targetUserIds, ["a", "b"]);
  assert.deepEqual(userIdCalls, [], "一覧を持つ送信は配達を引かない");
  assert.deepEqual((await findDispatch(deps, "counted")).targetUserIds, ["u1", "u2"]);
  assert.deepEqual(userIdCalls, [["counted", 10_001]]);
  fromDeliveries = Array.from({ length: 10_001 }, (_, i) => `u${i}`);
  assert.equal((await findDispatch(deps, "counted")).targetUserIds, null, "上限を超える送信は選び直し");
  assert.equal((await findDispatch(deps, "role")).targetUserIds, null);
  // 送り元は受け口に表示名がある時だけ表示名、無ければ null(鍵は返さない)
  assert.equal((await findDispatch(deps, "role")).sourceLabel, "管理者の一括送信");
  rows.role = dispatchRow({ id: "role", source: "fork.unknown" });
  assert.equal((await findDispatch(deps, "role")).sourceLabel, null);
  // 送った人は名前(id は返すが画面は出さない)
  assert.equal((await findDispatch(deps, "role")).actorName, "管理者 A");
  rows.role = dispatchRow({ id: "role", actor_id: null, actor_type: "system" });
  assert.equal((await findDispatch(deps, "role")).actorName, null);
});

test("送信の画面の絞りの選択肢: 受け口のカテゴリーの鍵・表示名・種別、管理者だけ", async () => {
  const categories = {
    notice: { key: "notice", label: "お知らせ", kind: "announcement", channels: ["email"] },
    forkSale: { key: "forkSale", label: "セール", kind: "promotion", channels: ["inApp"] },
  } as unknown as Record<string, MessageCategory>;
  assert.deepEqual(await dispatchCategoryOptions({ ...check(ctx("admin1")), categories }), [
    { key: "notice", label: "お知らせ", kind: "announcement" },
    { key: "forkSale", label: "セール", kind: "promotion" },
  ]);
  await rejects403(dispatchCategoryOptions({ ...check(ctx("user1", "user")), categories }));
});

test("送り元の表示名: 受け口 → 同じ鍵の連絡の名前 → 記録の宛先の一括送信、無ければ null", async () => {
  const deps = {
    sources: { "messaging.adminSend": { key: "messaging.adminSend", label: "管理画面から送信" } as MessageSource },
    messageLabel: async (key: string) => (key === "auth.passwordReset" ? "パスワードの再設定" : null),
    recordTargetLabel: async (key: string) => (key === "bankTransferReview.reviews" ? "振込レビュー" : null),
  };
  assert.equal(await sourceLabelOf(deps, "messaging.adminSend"), "管理画面から送信");
  assert.equal(await sourceLabelOf(deps, "auth.passwordReset"), "パスワードの再設定");
  assert.equal(await sourceLabelOf(deps, "bankTransferReview.reviews.bulk"), "振込レビューの一括送信");
  assert.equal(await sourceLabelOf(deps, "bankTransferReview.reviews.bulk.test"), "振込レビューの一括送信のテスト");
  assert.equal(await sourceLabelOf(deps, "closed.target.bulk"), null, "閉じたドメイン・無い記録の宛先は引かない");
  assert.equal(await sourceLabelOf(deps, "fork.unknown"), null);
});

test("続きを送る: 進めて監査 1 行、管理者でなければ 403", async () => {
  const audits: AuditRecordInput[] = [];
  const result = { expanded: false, claimed: 2, sent: 2, failed: 0, completed: true };
  const deps = { ...check(ctx("admin1")), continueSending: async () => result, recordAudit: async (input: AuditRecordInput) => audits.push(input) };
  assert.deepEqual(await adminContinueSending(deps, "d1"), result);
  assert.deepEqual([audits[0].action, audits[0].targetId], ["messaging.dispatch.continued", "d1"]);
  await rejects403(adminContinueSending({ ...deps, ...check(ctx("user1", "user")) }, "d1"));
});

test("グループ宛ての送信: 一覧・1 件に targetGroup { id, name }(1 ページに 1 回引く)、引けなければ name null、detail.target は形だけ", async () => {
  const G1 = "33333333-3333-4333-8333-333333333333";
  const G2 = "44444444-4444-4444-8444-444444444444";
  const group = (groupId: string) => ({ type: "group", groupId, version: 3 });
  const rows = [dispatchRow({ id: "d2", target: group(G1) }), dispatchRow({ id: "d1", target: group(G2) }), dispatchRow({ id: "d0" })];
  const asked: string[][] = [];
  const store: AdminDispatchStore = {
    listDispatches: async (_filter, _after, limit) => rows.slice(0, limit),
    findDispatch: async (id) => rows.find((row) => row.id === id) ?? null,
    listDeliveries: async () => [],
    listDispatchUserIds: async () => [],
    userNames: async () => new Map(),
  };
  const deps = {
    ...check(ctx("admin1")),
    dispatchStore: store,
    operationInputs: async () => ({ policy: null, counts: { failed: 0, unknown: 0 } }),
    sourceLabel: async () => null,
    groupNames: async (ids: readonly string[]) => {
      asked.push([...ids]);
      return new Map(ids.filter((id) => id === G1).map((id) => [id, "常連"]));
    },
  };
  const page = await listDispatches(deps, { limit: "3" } as never);
  assert.deepEqual(
    page.items.map((item) => item.targetGroup),
    [{ id: G1, name: "常連" }, { id: G2, name: null }, null],
  );
  assert.deepEqual(asked, [[G1, G2]], "1 ページに 1 回、グループ宛ての送信の分だけ");
  const one = await findDispatch(deps, "d2");
  assert.deepEqual(one.targetGroup, { id: G1, name: "常連" });
  assert.deepEqual(one.target, { type: "group" }, "固定した版・id は target に出さない");
  // 名前の部品が無い(門 userGroups が閉の結び)なら name null
  const closed = await findDispatch({ ...deps, groupNames: undefined }, "d2");
  assert.deepEqual(closed.targetGroup, { id: G1, name: null });
  assert.equal(toDispatchSummary(dispatchRow()).targetGroup, null);
});

test("記録の宛先の読み手(門番 loadRecordTarget): 鍵で遅延 import、上書きの messages を重ねる、無い鍵・enabled() が false は null", async () => {
  const { loadRecordTarget, recordTargetOpen } = await import("../domainGate");
  const item = (enabled: boolean): MessageRecordTarget => ({
    key: "",
    label: "店の注文",
    messages: ["testOnlyDomain.shipped"],
    enabled: () => enabled,
    resolveRecipients: async () => [],
  });
  // どの機能の規則にも載らないドメインは常に開(門番は項目の domain で門を見る)
  const registry = {
    "testOnlyDomain.orders": { key: "testOnlyDomain.orders", domain: "testOnlyDomain", target: async () => ({ recordTarget: { ...item(true), key: "testOnlyDomain.orders" } }) },
    "testOnlyDomain.off": { key: "testOnlyDomain.off", domain: "testOnlyDomain", target: async () => ({ recordTarget: { ...item(false), key: "testOnlyDomain.off" } }) },
    "testOnlyDomain.more": {
      key: "testOnlyDomain.more",
      domain: "testOnlyDomain",
      target: async () => ({ recordTarget: { ...item(true), key: "testOnlyDomain.more" } }),
      override: async () => ({ recordTargetOverride: { messages: ["testOnlyDomain.shipped", "testOnlyDomain.sale"] } }),
    },
    "testOnlyDomain.blank": {
      key: "testOnlyDomain.blank",
      domain: "testOnlyDomain",
      target: async () => ({ recordTarget: { ...item(true), key: "testOnlyDomain.blank" } }),
      // 中身の空の上書き(鍵を書いていない)は項目のまま
      override: async () => ({}),
    },
  };
  assert.equal(recordTargetOpen({ domain: "testOnlyDomain" }), true);
  assert.equal((await loadRecordTarget(registry, "testOnlyDomain.orders"))?.label, "店の注文");
  assert.deepEqual((await loadRecordTarget(registry, "testOnlyDomain.orders"))?.messages, ["testOnlyDomain.shipped"]);
  assert.deepEqual((await loadRecordTarget(registry, "testOnlyDomain.more"))?.messages, ["testOnlyDomain.shipped", "testOnlyDomain.sale"]);
  assert.deepEqual((await loadRecordTarget(registry, "testOnlyDomain.blank"))?.messages, ["testOnlyDomain.shipped"]);
  assert.equal(await loadRecordTarget(registry, "testOnlyDomain.off"), null);
  assert.equal(await loadRecordTarget(registry, "nope"), null);
  assert.equal(await loadRecordTarget(registry, "constructor"), null);
});
