// 定義連絡を管理者が送る口(./definitionSend.ts)の検査(送る口・記録の宛先・監査は偽物)
// - 入口 2 つ: 記録 { recordTarget, recordIds, message }(受信者ごとの記録の値・送り元 <項目>.bulk・afterSend)/ 全員・ロール・グループ(宛先の指定・予約)
// - 400: 項目の messages の外・adminTargets の外・off / カテゴリーの外の送信チャンネル・required のテキストの編集・管理者の値の型・宣言に無い管理者の値
// - 404: 連絡定義が無い・門 messagingBroadcast が閉(全員などの入口だけ、記録の入口は門の外)
// - プレビュー・テストは最初の記録の値、テキストの編集の欄を送る口に渡す、afterSend の引数(D196)、投げても送信は戻さない
// - 人数の見込み(definitions/estimate): 全員・ロール・グループの入口だけ、自由連絡の見込みと同じ数え方と形(RecipientEstimate をそのまま)、
//   adminTargets の外・記録の入口の形・知らない鍵・止めた定義は 400、無い定義・門が閉は 404、管理者でなければ 403
// - 選択肢(definitions/options): 記録の入口 = 項目と並んだ定義 / 全員などの入口 = 門の中、定義ごとの直せる欄・今の中身・管理者の値・送信チャンネルの固定と初めの状態・画面の文
// 実行: pnpm test src/domains/core/messaging/services/server/admin/definitionSend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import {
  MESSAGE_BLOCK_KINDS,
  defineMessage,
  defineMessageLayout,
  resolveMessageDefinition,
  type MessageLayout,
  type MessageRecordTarget,
  type MessageRecordTargetSent,
} from "@/lib/messaging";

import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import type { SendMessageToManyInput } from "../sendMessage/types";
import type { RecipientEstimate } from "../sendMessage/sender";
import {
  adminDefinitionEstimate,
  adminDefinitionPreview,
  adminDefinitionSend,
  adminDefinitionTest,
  adminDefinitionOptions,
  type AdminDefinitionSendDeps,
} from "./definitionSend";

const LAYOUT = defineMessageLayout({
  key: "notice",
  label: "お知らせ",
  fields: {
    subject: { type: "line", label: "件名", required: true },
    blocks: { type: "blocks", label: "本文", allow: MESSAGE_BLOCK_KINDS },
  },
  summary: (values) => ({ title: values.subject ?? "", body: "" }),
}) as MessageLayout;

const base = defineMessage({
  key: "shop.shipped",
  label: "発送のお知らせ",
  category: "shop",
  vars: z.object({ orderNo: z.string(), discount: z.number().optional(), note: z.string() }),
  varNames: {
    orderNo: { alias: "注文番号", description: "記録から" },
    discount: { alias: "割引", description: "管理者が入れる" },
    note: { alias: "備考", description: "管理者が入れる" },
  },
  layout: "notice",
  values: { subject: "{{orderNo}} を発送しました", blocks: [] },
  recordVars: { orderNo: { type: "line", required: true } },
  adminVars: { discount: { type: "number", required: false }, note: { type: "line", required: true } },
  adminTargets: ["records", "all"],
  channelModes: { line: "off" },
});

function resolved(over: Record<string, unknown> = {}): AnyResolvedMessageDefinition {
  return resolveMessageDefinition({ ...base, ...over } as typeof base, undefined, {
    kind: "transactional",
    channels: ["email", "inApp", "line"],
  }) as unknown as AnyResolvedMessageDefinition;
}

/** 記録 o1・o2 → 利用者 u1(まとめ)、o3 → u2。o1 の注文番号 A-1 */
function item(over: Partial<MessageRecordTarget> = {}): MessageRecordTarget {
  return {
    key: "shop.orders",
    label: "注文",
    messages: ["shop.shipped"],
    async resolveRecipients(ids) {
      const out = [];
      if (ids.includes("o1") || ids.includes("o2")) {
        out.push({ userId: "u1", vars: { orderNo: "A-1", other: "x" }, recordIds: ids.filter((id) => id === "o1" || id === "o2") });
      }
      if (ids.includes("o3")) out.push({ userId: "u2", vars: { orderNo: "B-3" }, recordIds: ["o3"] });
      return out;
    },
    ...over,
  };
}

function setup(
  options: {
    definition?: AnyResolvedMessageDefinition | null;
    item?: MessageRecordTarget | null;
    broadcastOpen?: boolean;
    /** shop.shipped 以外の定義(選択肢の検査) */
    others?: Record<string, AnyResolvedMessageDefinition>;
  } = {},
) {
  const sent: { resolved: AnyResolvedMessageDefinition; input: SendMessageToManyInput; options: unknown }[] = [];
  const previews: { resolved: AnyResolvedMessageDefinition; input: Record<string, unknown> }[] = [];
  const audits: AuditRecordInput[] = [];
  const estimates: unknown[] = [];
  const deps: AdminDefinitionSendDeps = {
    context: () => ({ actorId: "admin1", actorType: "user" }) as never,
    roleCategoryOf: async () => "admin",
    loadDefinition: async (key) =>
      key === "shop.shipped" ? (options.definition === undefined ? resolved() : options.definition) : (options.others?.[key] ?? null),
    recordTarget: async (key) => (key === "shop.orders" ? (options.item === undefined ? item() : options.item) : null),
    messageKeys: () => ["shop.shipped", ...Object.keys(options.others ?? {}), "shop.gone"],
    categories: { shop: { key: "shop", label: "ショップ", kind: "transactional", channels: ["email", "inApp", "line"], defaultChannels: ["email"] } },
    broadcastOpen: () => options.broadcastOpen ?? true,
    estimateRecipients: async (target) => {
      estimates.push(target);
      const estimate: RecipientEstimate =
        target.target.type === "group" ? { count: 120, fixedAtSend: true, memberLimit: 100, overLimit: true } : { count: 42, fixedAtSend: true };
      return estimate;
    },
    layouts: { notice: LAYOUT },
    enrichers: {},
    sendResolved: async (definition, input, _source, sendOptions) => {
      sent.push({ resolved: definition, input, options: sendOptions });
      return { dispatchId: "d1", status: "processing", deliveries: [], queuedCount: 2, channelCounts: {} };
    },
    previewMessage: async (source, input) => {
      previews.push({ resolved: source.resolved, input });
      return { messageKey: source.resolved.key, kind: "transactional", category: "shop", template: null, channels: [] };
    },
    recordAudit: async (input) => {
      audits.push(input);
    },
  };
  return { deps, sent, previews, audits, estimates };
}

const RECORDS = { recordTarget: "shop.orders", recordIds: ["o1", "o2", "o3"], message: "shop.shipped" };
const KEY = "idem-key-0001";
const status = (code: number) => (error: unknown) => error instanceof DomainError && error.status === code;

test("記録の入口: 宛先は項目の返す形、受信者ごとの値は recordVars の鍵だけ、管理者の値は入力の型で変換、送り元 <項目>.bulk", async () => {
  const { deps, sent, audits } = setup();
  const result = await adminDefinitionSend(deps, { entry: RECORDS, vars: { discount: "300", note: "ありがとう" }, idempotencyKey: KEY });
  assert.equal(sent.length, 1);
  const { input, options } = sent[0]!;
  assert.deepEqual(input.recipients, [{ userId: "u1" }, { userId: "u2" }]);
  assert.deepEqual(input.recipientVars, { "user:u1": { orderNo: "A-1" }, "user:u2": { orderNo: "B-3" } });
  assert.deepEqual(input.vars, { discount: 300, note: "ありがとう" });
  // 定義の固定 off(line)は落ちる
  assert.deepEqual(input.channels, ["email", "inApp"]);
  assert.equal(input.source, "shop.orders.bulk");
  assert.equal(input.target, undefined);
  assert.deepEqual(options, { recordVarKeys: ["orderNo"], editedFields: [] });
  assert.deepEqual(result, { dispatchId: "d1", status: "processing", counts: { recipientCount: 2, channelCounts: {}, queuedCount: 2 }, afterSend: null });
  assert.equal(audits[0]!.action, "messaging.dispatch.sent");
  assert.deepEqual((audits[0]!.metadata as Record<string, unknown>).entry, { recordTarget: "shop.orders", recordCount: 3 });
});

test("afterSend: 記録・送信の id と数・使う送信チャンネル・連絡定義・テキストの編集の後の欄(D196)。投げても送信は戻さない", async () => {
  const calls: MessageRecordTargetSent[] = [];
  const { deps, sent } = setup({ item: item({ afterSend: async (sentArgs) => void calls.push(sentArgs) }) });
  const result = await adminDefinitionSend(deps, {
    entry: RECORDS,
    vars: { note: "n" },
    channels: ["email"],
    edits: { subject: "直した件名 {{orderNo}}" },
    idempotencyKey: KEY,
  });
  assert.deepEqual(result.afterSend, { ok: true });
  assert.deepEqual(calls, [
    {
      recordIds: ["o1", "o2", "o3"],
      dispatchId: "d1",
      counts: { recipientCount: 2, channelCounts: {}, queuedCount: 2 },
      channels: ["email"],
      message: "shop.shipped",
      fields: { subject: "直した件名 {{orderNo}}", blocks: [] },
    },
  ]);
  assert.deepEqual(sent[0]!.options, { recordVarKeys: ["orderNo"], editedFields: ["subject"] });

  const failing = setup({ item: item({ afterSend: async () => Promise.reject(new Error("memo failed")) }) });
  const failed = await adminDefinitionSend(failing.deps, { entry: RECORDS, vars: { note: "n" }, idempotencyKey: KEY });
  assert.deepEqual(failed.afterSend, { ok: false, error: "memo failed" });
  assert.equal(failing.sent.length, 1);
  assert.deepEqual((failing.audits[0]!.metadata as Record<string, unknown>).afterSend, { ok: false, error: "memo failed" });
});

test("全員・ロール・グループの入口: 宛先の指定・予約・送り元 messaging.adminSend、記録の値は無い", async () => {
  const { deps, sent, audits } = setup();
  const at = new Date(Date.now() + 3_600_000).toISOString();
  await adminDefinitionSend(deps, { entry: { message: "shop.shipped", target: { type: "all" } }, vars: { note: "n" }, idempotencyKey: KEY, scheduledAt: at });
  const { input, options } = sent[0]!;
  assert.deepEqual(input.target, { type: "all" });
  assert.equal(input.source, "messaging.adminSend");
  assert.equal(input.scheduledAt?.toISOString(), at);
  assert.deepEqual(options, { recordVarKeys: [], editedFields: [] });
  assert.equal(audits[0]!.action, "messaging.dispatch.scheduled");
});

test("400: 並びの外・宛先の範囲の外・記録の予約・送信チャンネル・required のテキストの編集・管理者の値", async () => {
  const { deps, sent } = setup();
  const bad = (input: Record<string, unknown>) =>
    assert.rejects(adminDefinitionSend(deps, { entry: RECORDS, vars: { note: "n" }, idempotencyKey: KEY, ...input }), status(400));
  // 項目の messages の外
  await assert.rejects(
    adminDefinitionSend(setup({ item: item({ messages: [] }) }).deps, { entry: RECORDS, vars: { note: "n" }, idempotencyKey: KEY }),
    status(400),
  );
  // adminTargets に role が無い
  await bad({ entry: { message: "shop.shipped", target: { type: "role", roles: ["user"] } } });
  // 記録の入口は予約できない
  await bad({ scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
  // off の送信チャンネル・カテゴリーの外
  await bad({ channels: ["line"] });
  await bad({ channels: ["sms"] });
  // 管理者の値: 型が合わない・宣言に無い鍵(記録の値の鍵も)
  await bad({ vars: { note: "n", discount: "三百" } });
  await bad({ vars: { note: "n", orderNo: "X" } });
  // 直せない欄
  await bad({ edits: { unknown: "x" } });
  // idempotencyKey は必須
  await assert.rejects(adminDefinitionSend(deps, { entry: RECORDS, vars: { note: "n" } }), status(400));
  // required の連絡はテキストを編集できない
  const required = setup({ definition: resolved({ required: true }) });
  await assert.rejects(
    adminDefinitionSend(required.deps, { entry: RECORDS, vars: { note: "n" }, edits: { subject: "x" }, idempotencyKey: KEY }),
    status(400),
  );
  assert.equal(sent.length + required.sent.length, 0);
});

test("404: 連絡定義が無い・門 messagingBroadcast が閉なら全員などの入口(プレビュー・テストも)。記録の入口は門の外", async () => {
  const { deps } = setup({ broadcastOpen: false });
  const broadcast = { entry: { message: "shop.shipped", target: { type: "all" } }, vars: { note: "n" } };
  await assert.rejects(adminDefinitionSend(deps, { ...broadcast, idempotencyKey: KEY }), status(404));
  await assert.rejects(adminDefinitionPreview(deps, broadcast), status(404));
  await assert.rejects(adminDefinitionTest(deps, broadcast), status(404));
  await adminDefinitionSend(deps, { entry: RECORDS, vars: { note: "n" }, idempotencyKey: KEY });
  await assert.rejects(
    adminDefinitionSend(deps, { entry: { ...RECORDS, message: "shop.unknown" }, vars: {}, idempotencyKey: KEY }),
    status(400),
  );
  const missing = setup({ item: item({ messages: ["shop.shipped", "shop.gone"] }) });
  await assert.rejects(
    adminDefinitionSend(missing.deps, { entry: { ...RECORDS, message: "shop.gone" }, vars: {}, idempotencyKey: KEY }),
    status(404),
  );
});

test("プレビュー・テストは選んだ最初の記録の値(見本の受信者 = 操作した管理者)、テストは afterSend を呼ばない", async () => {
  const calls: unknown[] = [];
  const { deps, previews, sent } = setup({ item: item({ afterSend: async (args) => void calls.push(args) }) });
  await adminDefinitionPreview(deps, { entry: { ...RECORDS, recordIds: ["o3", "o1"] }, vars: { note: "n" } });
  assert.deepEqual(previews[0]!.input, {
    vars: { note: "n" },
    channels: ["email", "inApp"],
    userId: "admin1",
    recipientVars: { orderNo: "B-3" },
    recordVarKeys: ["orderNo"],
  });
  const tested = await adminDefinitionTest(deps, { entry: RECORDS, vars: { note: "n" } });
  assert.equal(tested.dispatchId, "d1");
  assert.deepEqual(sent[0]!.input.recipients, [{ userId: "admin1" }]);
  assert.deepEqual(sent[0]!.input.recipientVars, { "user:admin1": { orderNo: "A-1" } });
  assert.equal(sent[0]!.input.isTest, true);
  assert.equal(sent[0]!.input.source, "shop.orders.bulk.test");
  assert.deepEqual(calls, []);
});

test("選択肢 ?recordTarget=: 項目と、並びのうち読める・止められていない・records を許す定義(並びの順)", async () => {
  const others = {
    "shop.off": { ...resolved({ key: "shop.off" }), enabled: false },
    "shop.broadcastOnly": resolved({ key: "shop.broadcastOnly", adminTargets: ["all"] }),
  };
  const { deps } = setup({ item: item({ messages: ["shop.gone", "shop.off", "shop.broadcastOnly", "shop.shipped"] }), others });
  const options = await adminDefinitionOptions(deps, { recordTarget: "shop.orders" });
  assert.deepEqual(options.recordTarget, { key: "shop.orders", label: "注文" });
  assert.deepEqual(options.definitions.map((d) => d.key), ["shop.shipped"]);
  await assert.rejects(adminDefinitionOptions(deps, { recordTarget: "shop.closed" }), status(404));
});

test("選択肢の定義 1 本: レイアウトの欄・直せる欄と今の中身・管理者の値・送信チャンネルの固定と初めの状態(on ∪ defaultChannels ∩ free)・画面の文", async () => {
  const definition = resolved({ channelModes: { line: "off", inApp: "on" }, adminText: { description: "発送を知らせます", confirm: "送りますか" } });
  const { deps } = setup({ definition });
  const [option] = (await adminDefinitionOptions(deps, { recordTarget: "shop.orders" })).definitions;
  assert.deepEqual(option, {
    key: "shop.shipped",
    label: "発送のお知らせ",
    layout: { key: "notice", label: "お知らせ", version: 1, fields: LAYOUT.fields },
    editableFields: ["subject", "blocks"],
    values: { subject: "{{orderNo}} を発送しました", blocks: [] },
    adminVars: [
      { key: "discount", alias: "割引", type: "number", required: false },
      { key: "note", alias: "備考", type: "line", required: true },
    ],
    channels: { email: "free", inApp: "on", line: "off" },
    initialChannels: ["email", "inApp"],
    required: false,
    adminTargets: ["records", "all"],
    adminText: { description: "発送を知らせます", confirm: "送りますか" },
  });
});

test("選択肢: required の定義は直せる欄も今の中身も空、画面の文が無ければ null", async () => {
  const { deps } = setup({ definition: resolved({ required: true }) });
  const [option] = (await adminDefinitionOptions(deps, { recordTarget: "shop.orders" })).definitions;
  assert.deepEqual(option!.editableFields, []);
  assert.deepEqual(option!.values, {});
  assert.equal(option!.required, true);
  assert.equal(option!.adminText, null);
});

test("選択肢 ?entry=broadcast: 全員・ロール・グループのどれかを許す定義(生成の一覧の順)、門 messagingBroadcast が閉なら 404、条件の誤りは 400", async () => {
  const others = { "shop.recordsOnly": resolved({ key: "shop.recordsOnly", adminTargets: undefined }) };
  const { deps } = setup({ others });
  const options = await adminDefinitionOptions(deps, { entry: "broadcast" });
  assert.equal(options.recordTarget, null);
  assert.deepEqual(options.definitions.map((d) => d.key), ["shop.shipped"], "adminTargets を書かない定義は records だけ");
  await assert.rejects(adminDefinitionOptions(setup({ broadcastOpen: false }).deps, { entry: "broadcast" }), status(404));
  await assert.rejects(adminDefinitionOptions(deps, {}), status(400));
  await assert.rejects(adminDefinitionOptions(deps, { entry: "broadcast", recordTarget: "shop.orders" }), status(400));
  await assert.rejects(adminDefinitionOptions(deps, { entry: "all" } as never), status(400));
});

test("人数の見込み: 全員・ロール・グループの宛先を見込みの口へ渡し、自由連絡と同じ RecipientEstimate をそのまま返す", async () => {
  const others = { "shop.news": resolved({ key: "shop.news", adminTargets: ["all", "role", "group"] }) };
  const { deps, estimates } = setup({ others });
  assert.deepEqual(await adminDefinitionEstimate(deps, { message: "shop.news", target: { type: "all" } }), { count: 42, fixedAtSend: true });
  assert.deepEqual(await adminDefinitionEstimate(deps, { message: "shop.news", target: { type: "role", roles: ["user"] } }), { count: 42, fixedAtSend: true });
  const GROUP = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(await adminDefinitionEstimate(deps, { message: "shop.news", target: { type: "group", groupId: GROUP } }), {
    count: 120,
    fixedAtSend: true,
    memberLimit: 100,
    overLimit: true,
  });
  assert.deepEqual(estimates, [
    { target: { type: "all" } },
    { target: { type: "role", roles: ["user"] } },
    { target: { type: "group", groupId: GROUP } },
  ]);
});

test("人数の見込み: adminTargets の外・記録の入口の形・知らない鍵・止めた定義は 400、無い定義・門が閉は 404、管理者でなければ 403", async () => {
  const { deps, estimates } = setup();
  // shop.shipped の adminTargets は records と all だけ
  await assert.rejects(adminDefinitionEstimate(deps, { message: "shop.shipped", target: { type: "role", roles: ["user"] } }), status(400));
  await assert.rejects(adminDefinitionEstimate(deps, { recordTarget: "shop.orders", recordIds: ["o1"], message: "shop.shipped" }), status(400));
  await assert.rejects(adminDefinitionEstimate(deps, { message: "shop.shipped", target: { type: "all" }, extra: 1 }), status(400));
  await assert.rejects(adminDefinitionEstimate(deps, { message: "shop.shipped", target: { type: "everyone" } }), status(400));
  await assert.rejects(adminDefinitionEstimate(setup({ definition: { ...resolved(), enabled: false } }).deps, { message: "shop.shipped", target: { type: "all" } }), status(400));
  await assert.rejects(adminDefinitionEstimate(deps, { message: "shop.gone", target: { type: "all" } }), status(404));
  await assert.rejects(adminDefinitionEstimate(setup({ broadcastOpen: false }).deps, { message: "shop.shipped", target: { type: "all" } }), status(404));
  await assert.rejects(adminDefinitionEstimate({ ...deps, roleCategoryOf: async () => "user" }, { message: "shop.shipped", target: { type: "all" } }), status(403));
  assert.equal(estimates.length, 0, "誤りは数えに行かない");
  assert.deepEqual(await adminDefinitionEstimate(deps, { message: "shop.shipped", target: { type: "all" } }), { count: 42, fixedAtSend: true });
});
