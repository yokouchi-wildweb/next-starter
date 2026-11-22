// 予約した送信の送る前の直し(./scheduledEdit.ts)の検査。DB・中身の組み立て・送信 1 件の DTO は偽物、時刻の検査は本物の送る口(sender の checkSchedule)
// - 自由連絡: 変えた欄を送信に残した欄の中身に重ね、送る口と同じ組み方で検査(カテゴリーの外の送信チャンネル・必須の欄を消す は 400)
// - 定義連絡: 直せる欄だけ(外は 400)・required は 400・編集した欄の印は前の印 ∪ 今回
// - 書く列に宛先・人数・vars は入らない。中身の列は組み直した物(直した送信チャンネル・欄の中身)
// - 条件つきの更新: 読んでから書くまでに cron が拾った送信は 409(not_scheduled)、監査を書かない
// - 409: 送り始めた(not_scheduled)・削除した(deleted)、本文の無い送信(body_missing)・テンプレートを消した送信(template_missing)は時刻だけ
// - 404 無い送信、400 過ぎた時刻・maxDaysAhead より先・空の入力、403 管理者でない、監査 messaging.dispatch.edited
// - 直しの材料(adminScheduledEditOptions): 直せる欄・送信チャンネルの固定・今の欄の中身、時刻だけの送信は空の材料、予約でない送信は 409。
//   材料が直せると言う欄は直しが受け、言わない欄は直しが断る(同じ決まり)
// 実行: pnpm test src/domains/core/messaging/services/server/admin/scheduledEdit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { defineMessage, resolveMessageDefinition } from "@/lib/messaging";

import type { MessageDispatch } from "../../../entities/model";
import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { createMessageSender } from "../sendMessage/sender";
import {
  FIXED_NOW,
  TEST_CATEGORIES,
  TEST_LAYOUTS,
  createDeps,
  createMemoryStore,
  createTestChannel,
} from "../sendMessage/testHelpers";
import type { AdminDispatchDetail } from "./dispatchDto";
import { adminEditScheduledDispatch, adminScheduledEditOptions, type AdminScheduledEditDeps, type ScheduledEditPatch } from "./scheduledEdit";

const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(FIXED_NOW.getTime() + days * DAY).toISOString();

const sender = createMessageSender(createDeps({ store: createMemoryStore() }));

/** 自由連絡の予約(レイアウト notice を直に選んだ物、カテゴリー newsInApp = test・inApp) */
function freeRow(over: Partial<MessageDispatch> = {}): MessageDispatch {
  return {
    id: "d1",
    status: "scheduled",
    deleted_at: null,
    scheduled_at: new Date(later(2)),
    message_key: null,
    template_id: null,
    template_version: null,
    template_edited: false,
    edited_fields: null,
    layout: "notice",
    layout_version: 1,
    values: { subject: "元の件名", blocks: [] },
    channels: ["test", "inApp"],
    category: "newsInApp",
    kind: "promotion",
    record: null,
    vars: { a: 1 },
    target: { type: "all" },
    recipient_count: 0,
    ...over,
  } as MessageDispatch;
}

const shipped = defineMessage({
  key: "shop.shipped",
  label: "発送のお知らせ",
  category: "shop",
  vars: z.object({ orderNo: z.string() }),
  varNames: { orderNo: { alias: "注文番号", description: "記録から" } },
  layout: "notice",
  values: { subject: "{{orderNo}} を発送しました", blocks: [] },
  adminEditableOnly: ["subject"],
  adminTargets: ["all"],
});

function definition(over: Record<string, unknown> = {}): AnyResolvedMessageDefinition {
  return resolveMessageDefinition({ ...shipped, ...over } as typeof shipped, undefined, {
    kind: "transactional",
    channels: ["email", "inApp"],
  }) as unknown as AnyResolvedMessageDefinition;
}

/** 定義連絡の予約(shop.shipped、前に blocks を編集した印) */
const definitionRow = (over: Partial<MessageDispatch> = {}) =>
  freeRow({
    message_key: "shop.shipped",
    category: "shop",
    kind: "transactional",
    channels: ["email", "inApp"],
    values: { subject: "{{orderNo}} を発送しました", blocks: [] },
    edited_fields: ["blocks"],
    ...over,
  });

function setup(row: MessageDispatch | null, options: { role?: string; definition?: AnyResolvedMessageDefinition | null; pickedByCron?: boolean } = {}) {
  const rows = new Map<string, MessageDispatch>(row ? [[row.id, row]] : []);
  const writes: { id: string; patch: ScheduledEditPatch }[] = [];
  const built: { resolved: AnyResolvedMessageDefinition; channels: readonly string[]; vars: Record<string, unknown> }[] = [];
  const audits: AuditRecordInput[] = [];
  const deps: AdminScheduledEditDeps = {
    context: () => ({ actorId: "admin1", actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    store: {
      findDispatch: async (id) => rows.get(id) ?? null,
      async updateScheduled(id, patch) {
        const current = rows.get(id);
        // cron の activateScheduled が読んだ後・書く前に拾った
        if (current && options.pickedByCron) rows.set(id, { ...current, status: "processing" });
        const now = rows.get(id);
        if (!now || now.status !== "scheduled" || now.deleted_at) return false;
        writes.push({ id, patch });
        rows.set(id, { ...now, ...patch } as MessageDispatch);
        return true;
      },
    },
    now: () => FIXED_NOW,
    layouts: TEST_LAYOUTS,
    categories: { ...TEST_CATEGORIES, shop: { key: "shop", label: "ショップ", kind: "transactional", channels: ["email", "inApp"] } },
    channels: { test: createTestChannel("test"), inApp: createTestChannel("inApp"), email: createTestChannel("email") },
    enrichers: {},
    loadDefinition: async (key) => (key === "shop.shipped" ? (options.definition === undefined ? definition() : options.definition) : null),
    loadTemplateVersion: async () => null,
    resolveDispatch: async (dispatch) => ({ resolved: { values: dispatch.values ?? {} } as unknown as AnyResolvedMessageDefinition }),
    checkSchedule: sender.checkSchedule,
    maxScheduleDays: 30,
    async scheduledContent(resolved, channels, vars) {
      built.push({ resolved, channels, vars });
      return {
        channels: [...channels],
        headings: { [channels[0]!]: "見出し" },
        rendered: null,
        values: { ...((resolved.values ?? {}) as Record<string, unknown>) },
        layout_version: 1,
        channel_counts: {},
      };
    },
    findDetail: async (id) => ({ id, status: rows.get(id)?.status }) as unknown as AdminDispatchDetail,
    recordAudit: async (input) => {
      audits.push(input);
    },
  };
  return { deps, rows, writes, built, audits };
}

const rejectsWith = (promise: Promise<unknown>, status: number, code?: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.status === status && (code === undefined || error.code === code));

test("自由連絡: 変えた欄を重ね、送信チャンネル・時刻を直す。宛先・人数・vars は書かない。監査に 1 行", async () => {
  const s = setup(freeRow());
  const detail = await adminEditScheduledDispatch(s.deps, "d1", { edits: { subject: "直した件名" }, channels: ["test"], scheduledAt: later(5) });
  assert.equal(detail.id, "d1");
  assert.equal(s.writes.length, 1);
  const { patch } = s.writes[0]!;
  assert.deepEqual(patch.channels, ["test"]);
  // 送る口と同じ整え(空の並びは「無い」)の後の欄の中身
  assert.equal((patch.values as Record<string, unknown>).subject, "直した件名");
  assert.equal((patch.scheduled_at as Date).toISOString(), later(5));
  for (const key of ["target", "recipient_count", "vars", "idempotency_key", "actor_id", "status"]) assert.equal(key in patch, false, key);
  // 中身は送信の vars で組む
  assert.deepEqual(s.built[0]!.vars, { a: 1 });
  assert.equal(s.audits.length, 1);
  assert.equal(s.audits[0]!.action, "messaging.dispatch.edited");
  assert.deepEqual(s.audits[0]!.metadata, {
    fields: ["subject"],
    channels: { before: ["test", "inApp"], after: ["test"] },
    scheduledAt: { before: later(2), after: later(5) },
  });
});

test("時刻だけ: 中身の列は組み直さない", async () => {
  const s = setup(freeRow());
  await adminEditScheduledDispatch(s.deps, "d1", { scheduledAt: later(1) });
  assert.equal(s.built.length, 0);
  assert.deepEqual(Object.keys(s.writes[0]!.patch).sort(), ["scheduled_at", "updatedAt"]);
});

test("自由連絡: 送る時と同じ検査(カテゴリーの外の送信チャンネル・必須の欄を消す)は 400", async () => {
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", { channels: ["email"] }), 400);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", { edits: { blocks: "並びでない" } }), 400);
  // 件名はメールを送る時だけ必須(D211): メールの無い送信(test・inApp)は件名を消せる
  const cleared = setup(freeRow());
  await adminEditScheduledDispatch(cleared.deps, "d1", { edits: { subject: null } });
  assert.equal("subject" in (cleared.writes[0]!.patch.values as Record<string, unknown>), false);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", { edits: { nope: "x" } }), 400);
});

test("定義連絡: 直せる欄だけ・編集した欄の印は前の印 ∪ 今回、直せない欄と required は 400", async () => {
  const s = setup(definitionRow());
  await adminEditScheduledDispatch(s.deps, "d1", { edits: { subject: "{{orderNo}} の発送" } });
  assert.deepEqual(s.writes[0]!.patch.edited_fields, ["blocks", "subject"]);
  assert.deepEqual(s.writes[0]!.patch.values, { subject: "{{orderNo}} の発送", blocks: [] });
  assert.deepEqual(s.writes[0]!.patch.channels, ["email", "inApp"]);
  await rejectsWith(adminEditScheduledDispatch(setup(definitionRow()).deps, "d1", { edits: { blocks: [{ type: "text", text: "x" }], subject: "x" } }), 400);
  await rejectsWith(adminEditScheduledDispatch(setup(definitionRow()).deps, "d1", { edits: { subject: "{{unknown}}" } }), 400);
  await rejectsWith(
    adminEditScheduledDispatch(setup(definitionRow(), { definition: definition({ required: true }) }).deps, "d1", { edits: { subject: "x" } }),
    400,
  );
  await rejectsWith(adminEditScheduledDispatch(setup(definitionRow(), { definition: null }).deps, "d1", { edits: { subject: "x" } }), 409, "definition_missing");
});

test("条件つきの更新: 読んでから書くまでに cron が拾った送信は直さない(409 not_scheduled、監査なし)", async () => {
  const s = setup(freeRow(), { pickedByCron: true });
  await rejectsWith(adminEditScheduledDispatch(s.deps, "d1", { edits: { subject: "直した件名" } }), 409, "not_scheduled");
  assert.equal(s.writes.length, 0);
  assert.equal(s.audits.length, 0);
});

test("409: 送り始めた・削除した送信、本文の無い送信とテンプレートを消した送信は時刻だけ", async () => {
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow({ status: "processing" })).deps, "d1", { scheduledAt: later(1) }), 409, "not_scheduled");
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow({ deleted_at: FIXED_NOW })).deps, "d1", { scheduledAt: later(1) }), 409, "deleted");
  const noBody = setup(freeRow({ values: null }));
  await rejectsWith(adminEditScheduledDispatch(noBody.deps, "d1", { channels: ["test"] }), 409, "body_missing");
  await adminEditScheduledDispatch(noBody.deps, "d1", { scheduledAt: later(1) });
  assert.equal(noBody.writes.length, 1);
  const gone = setup(freeRow({ template_version: 3 }));
  await rejectsWith(adminEditScheduledDispatch(gone.deps, "d1", { edits: { subject: "x" } }), 409, "template_missing");
  await adminEditScheduledDispatch(gone.deps, "d1", { scheduledAt: later(1) });
  assert.equal(gone.writes.length, 1);
});

test("404 無い送信、400 過ぎた時刻・maxDaysAhead より先・空の入力・知らない鍵、403 管理者でない", async () => {
  await rejectsWith(adminEditScheduledDispatch(setup(null).deps, "d1", { scheduledAt: later(1) }), 404);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", { scheduledAt: later(-1) }), 400);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", { scheduledAt: later(31) }), 400);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", {}), 400);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow()).deps, "d1", { target: { type: "all" } }), 400);
  await rejectsWith(adminEditScheduledDispatch(setup(freeRow(), { role: "user" }).deps, "d1", { scheduledAt: later(1) }), 403);
});

test("直しの材料: 自由連絡 = レイアウトの欄の全部・カテゴリーの送信チャンネルが全部 free・今の欄の中身・日数の上限", async () => {
  const options = await adminScheduledEditOptions(setup(freeRow()).deps, "d1");
  assert.deepEqual(options.layout && { key: options.layout.key, version: options.layout.version }, { key: "notice", version: 1 });
  assert.deepEqual(options.editableFields, Object.keys(TEST_LAYOUTS.notice!.fields));
  assert.deepEqual(options.values, { subject: "元の件名", blocks: [] });
  assert.deepEqual(options.channels, { test: "free", inApp: "free" });
  assert.equal(options.maxScheduleDays, 30);
});

test("直しの材料: 定義連絡 = 連絡定義の直せる欄・定義の固定、required の連絡は直せる欄なし", async () => {
  const options = await adminScheduledEditOptions(setup(definitionRow()).deps, "d1");
  assert.deepEqual(options.editableFields, ["subject"]);
  assert.deepEqual(options.channels, { email: "free", inApp: "free" });
  const fixed = await adminScheduledEditOptions(setup(definitionRow(), { definition: definition({ channelModes: { email: "on", inApp: "off" } }) }).deps, "d1");
  assert.deepEqual(fixed.channels, { email: "on", inApp: "off" });
  const required = await adminScheduledEditOptions(setup(definitionRow(), { definition: definition({ required: true }) }).deps, "d1");
  assert.deepEqual(required.editableFields, []);
});

test("直しの材料と直しは同じ決まり: 材料が直せると言う欄は直しが受け、言わない欄は直しが断る", async () => {
  for (const row of [freeRow(), definitionRow()]) {
    const options = await adminScheduledEditOptions(setup(row).deps, "d1");
    const layoutFields = Object.keys(TEST_LAYOUTS.notice!.fields);
    const editable = options.editableFields.find((key) => key === "subject");
    assert.ok(editable, "件名は直せる");
    const s = setup(row);
    await adminEditScheduledDispatch(s.deps, "d1", { edits: { [editable]: "直した件名" } });
    assert.equal(s.writes.length, 1);
    const notEditable = layoutFields.find((key) => !options.editableFields.includes(key));
    if (notEditable) {
      await rejectsWith(
        adminEditScheduledDispatch(setup(row).deps, "d1", { edits: { [notEditable]: [{ type: "paragraph", text: "x" }] } }),
        400,
      );
    }
    // 材料に無い欄の鍵(レイアウトの外)はどちらでも断る
    assert.equal(options.editableFields.includes("nope"), false);
    await rejectsWith(adminEditScheduledDispatch(setup(row).deps, "d1", { edits: { nope: "x" } }), 400);
  }
});

test("直しの材料: 時刻だけの送信(本文なし・テンプレートを消した)は空の材料、予約でない・削除した送信は 409、無い送信は 404", async () => {
  const empty = { layout: null, editableFields: [], values: null, channels: {}, maxScheduleDays: 30 };
  assert.deepEqual(await adminScheduledEditOptions(setup(freeRow({ values: null })).deps, "d1"), empty);
  assert.deepEqual(await adminScheduledEditOptions(setup(freeRow({ template_version: 3 })).deps, "d1"), empty);
  await rejectsWith(adminScheduledEditOptions(setup(freeRow({ status: "processing" })).deps, "d1"), 409, "not_scheduled");
  await rejectsWith(adminScheduledEditOptions(setup(freeRow({ deleted_at: FIXED_NOW })).deps, "d1"), 409, "deleted");
  await rejectsWith(adminScheduledEditOptions(setup(definitionRow(), { definition: null }).deps, "d1"), 409, "definition_missing");
  await rejectsWith(adminScheduledEditOptions(setup(null).deps, "d1"), 404);
  await rejectsWith(adminScheduledEditOptions(setup(freeRow(), { role: "user" }).deps, "d1"), 403);
});
