// @ts-nocheck
// D112: restore before ship (指令 59 で文言の編集のプレビューがひな形の材料(layout・values・summary)を返し、1 件が embedded を返す形になった。出荷の前に書き直して回す)
// 管理画面の文言の上書きの service の検査(DB・監査は偽物)
// - 欄の道 = ひな形の欄の鍵(D132)。直せる欄 = ひな形の欄のうち種類の経路で使う物の全部、adminEditableOnly で絞る
// - 一覧: 直せる欄のある連絡(と行の残る連絡)、数(使えない行 unusableCount)。直せない連絡(required)は一覧に出ず 1 件は 404
// - 1 件: 欄ごとの宣言・使う経路・コードの値(定義の values)・管理画面の値・送る時の値・印、使ってよい {{鍵}}(秘密を除く)。
//   版を移せない行・古い形の行(経路.欄、版なし)・検査を通らない行は使えない(unusable、行は残る)
// - 行は保存した版から今の版の欄へ移して読む。保存は今の版で書き、同じ欄へ移る前の版の行を消す
// - プレビュー: 保存した値と未保存の値を重ね、文字に印を付けて送る口と同じ組み立てで描く(印は data-field に)
// - 保存: 送る口と同じ検査(誤りは 400)、ひな形の版・直した時のコードの値と操作者を残し、監査に残す / 戻す = 行を消す(無ければ 404)
// - 管理者でなければ 403
// 実行: pnpm test src/features/core/messaging/services/server/overrides
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import {
  MESSAGE_BLOCK_KINDS,
  defineMessage,
  defineMessageLayout,
  resolveMessageDefinition,
  secretVar,
  type MessageLayout,
} from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { createOverrideService } from "./overrideService";
import type { MessageOverrideRecord } from "./types";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** 版 2: 版 1 の heading を subject へ移した、メールだけの preheader を持つ */
const LAYOUT = defineMessageLayout({
  key: "notice",
  label: "お知らせ",
  version: 2,
  revisions: { 1: { heading: "subject" } },
  fields: {
    subject: { type: "line", label: "件名", required: true, placeholder: "例の件名" },
    blocks: { type: "blocks", label: "本文", allow: MESSAGE_BLOCK_KINDS },
    preheader: { type: "line", label: "プリヘッダー", channels: ["email"] },
  },
  summary: (values) => ({ title: values.subject ?? "", body: "" }),
}) as MessageLayout;

const editable = resolveMessageDefinition(
  defineMessage({
    key: "shop.notice",
    label: "テストの連絡",
    category: "shop",
    vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
    adminEditableOnly: ["subject", "blocks"],
    layout: "notice",
    values: { subject: "{{name}} 様へ", blocks: [{ type: "paragraph", text: "一" }] },
  }),
  undefined,
  { kind: "transactional", channels: ["email", "inApp"] },
) as unknown as AnyResolvedMessageDefinition;

const plain = resolveMessageDefinition(
  defineMessage({
    key: "shop.plain",
    label: "テストの連絡",
    category: "shop",
    required: true,
    vars: z.object({}),
    layout: "notice",
    values: { subject: "件名", blocks: [{ type: "paragraph", text: "本文" }] },
  }),
  undefined,
  { kind: "transactional", channels: ["email"] },
) as unknown as AnyResolvedMessageDefinition;

function setup(options: { actorId?: string | null; role?: string; rows?: MessageOverrideRecord[] } = {}) {
  const rows: MessageOverrideRecord[] = [...(options.rows ?? [])];
  const previews: { channel: string; content: unknown }[] = [];
  const audits: AuditRecordInput[] = [];
  const definitions: Record<string, AnyResolvedMessageDefinition> = { "shop.notice": editable, "shop.plain": plain };
  const service = createOverrideService({
    context: () => ({ actorId: options.actorId === undefined ? ADMIN : options.actorId, actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    messageKeys: () => Object.keys(definitions),
    categoryLabel: (category: string) => (category === "shopNews" ? "お店のお知らせ" : null),
    channelInfo: (channel) => ({ label: channel.toUpperCase() }),
    loadDefinition: async (key) =>
      definitions[key] ? { resolved: definitions[key], layout: LAYOUT, check: { variableKeys: ["displayName"] } } : null,
    store: {
      listByMessage: async (key) => rows.filter((row) => row.messageKey === key),
      listAll: async () => [...rows],
      upsert: async ({ messageKey, fieldPath, layoutVersion, value, codeValue, updatedBy }) => {
        const index = rows.findIndex((row) => row.messageKey === messageKey && row.fieldPath === fieldPath);
        const row = { messageKey, fieldPath, layoutVersion, value, codeValue, updatedBy, updatedAt: new Date("2026-11-12T00:00:00Z") };
        if (index >= 0) rows[index] = row;
        else rows.push(row);
      },
      remove: async (key, path) => {
        const index = rows.findIndex((row) => row.messageKey === key && row.fieldPath === path);
        if (index < 0) return false;
        rows.splice(index, 1);
        return true;
      },
    },
    recordAudit: async (input) => audits.push(input),
    channelContent: async (resolved, channel) => ({ channel, values: resolved.values }),
    channelPreview: async (channel, input) => {
      previews.push({ channel, content: input.content });
      const values = (input.content as { values: { subject: string } }).values;
      return { html: `<p>${values.subject}</p>`, text: values.subject };
    },
  });
  return { service, rows, audits, previews };
}

const row = (fieldPath: string, value: unknown, codeValue: unknown, layoutVersion: number | null = 2): MessageOverrideRecord => ({
  messageKey: "shop.notice",
  fieldPath,
  layoutVersion,
  value,
  codeValue,
  updatedBy: ADMIN,
  updatedAt: new Date("2026-11-11T00:00:00Z"),
});

async function rejectsWith(run: Promise<unknown>, status: number) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    return true;
  });
}

test("一覧: 直せる欄のある連絡だけ、数(使えない行を含む)を返す", async () => {
  const { service } = setup({
    rows: [row("subject", "{{nope}}", "{{name}} 様へ"), row("email.subject", "古い形", null, null)],
  });
  assert.deepEqual(await service.listMessages(), [
    {
      key: "shop.notice",
      label: "テストの連絡",
      kind: "transactional",
      category: "shop",
      categoryLabel: null,
      channels: [
        { key: "email", label: "EMAIL" },
        { key: "inApp", label: "INAPP" },
      ],
      editableCount: 2,
      editedCount: 2,
      unusableCount: 2,
      codeChangedCount: 0,
    },
  ]);
});

test("1 件: 欄ごとの宣言・経路・コードの値・印、前の版の行は今の欄へ移す、古い形・捨てた欄の行は使えない", async () => {
  const { service } = setup({
    rows: [
      row("heading", "前の版の件名 {{name}}", "{{name}} 様へ", 1),
      row("blocks", [{ type: "paragraph", text: "{{token}}" }], [{ type: "paragraph", text: "一" }]),
      row("email.subject", "古い形", null, null),
    ],
  });
  const detail = await service.getMessage("shop.notice");
  assert.deepEqual(detail.allowedKeys, ["name", "recipientName", "recipientEmail", "serviceName", "appBaseUrl", "displayName"]);
  const [subject, blocks, old] = detail.fields;
  assert.deepEqual(
    { ...subject, updatedAt: null },
    {
      path: "subject",
      spec: { type: "line", label: "件名", required: true, placeholder: "例の件名" },
      channels: ["email", "inApp"],
      editable: true,
      codeValue: "{{name}} 様へ",
      value: "前の版の件名 {{name}}",
      effective: "前の版の件名 {{name}}",
      edited: true,
      codeChanged: false,
      unusable: false,
      problem: null,
      updatedAt: null,
    },
  );
  // 秘密の鍵を使う行は当てない(送る時はコードの値)
  assert.equal(blocks.unusable, true);
  assert.deepEqual(blocks.effective, [{ type: "paragraph", text: "一" }]);
  assert.deepEqual([old.path, old.editable, old.unusable, old.spec, old.channels], ["email.subject", false, true, null, []]);
  assert.match(old.problem ?? "", /古い形/);
  assert.equal(detail.fields.length, 3, "adminEditableOnly の外の preheader は出さない");
});

test("保存: 今の版で書き、同じ欄へ移る前の版の行を消す。コードの値と操作者を残し監査に残す。戻すは行を消す", async () => {
  const { service, rows, audits } = setup({ rows: [row("heading", "前の版", "x", 1)] });
  const detail = await service.saveField("shop.notice", { fieldPath: "subject", value: "{{displayName}} 様、{{serviceName}} です" });
  assert.equal(detail.fields[0].effective, "{{displayName}} 様、{{serviceName}} です");
  assert.deepEqual(rows.map((r) => [r.fieldPath, r.layoutVersion, r.codeValue, r.updatedBy]), [["subject", 2, "{{name}} 様へ", ADMIN]]);
  assert.deepEqual(audits.map((a) => [a.action, a.targetId]), [["messaging.override.updated", "shop.notice:subject"]]);

  const reset = await service.resetField("shop.notice", "subject");
  assert.equal(rows.length, 0);
  assert.equal(reset.fields[0].edited, false);
  assert.equal(audits[1].action, "messaging.override.reset");
  await rejectsWith(service.resetField("shop.notice", "subject"), 404);
});

test("戻す: 使えない古い形の行は保存した時の鍵で消せる", async () => {
  const { service, rows } = setup({ rows: [row("email.subject", "古い形", null, null)] });
  await service.resetField("shop.notice", "email.subject");
  assert.equal(rows.length, 0);
});

test("保存の誤り: 入力・直せない欄・型・使えない鍵・秘密の鍵は 400、無い連絡は 404", async () => {
  const { service, rows, audits } = setup();
  for (const input of [
    null,
    { fieldPath: "subject", value: "x", extra: 1 },
    { fieldPath: "preheader", value: "x" },
    { fieldPath: "email.subject", value: "x" },
    { fieldPath: "subject", value: "" },
    { fieldPath: "subject", value: "{{nope}}" },
    { fieldPath: "subject", value: "{{token}}" },
    { fieldPath: "blocks", value: [{ type: "nope" }] },
  ]) {
    await rejectsWith(service.saveField("shop.notice", input), 400);
  }
  await rejectsWith(service.saveField("shop.none", { fieldPath: "subject", value: "x" }), 404);
  await rejectsWith(service.getMessage("shop.plain"), 404);
  assert.equal(rows.length, 0);
  assert.equal(audits.length, 0);
});

test.skip("プレビュー: 保存した値と未保存の値(検査を通る物)を重ね、文字の欄に印を付けて描く", async () => {
  const { service, previews } = setup({ rows: [row("subject", "保存した件名", null)] });
  const saved = await service.previewMessage("shop.notice", { channel: "email", values: {} });
  assert.deepEqual(saved, { channel: "email", html: '<p><span data-field="subject">保存した件名</span></p>', text: "保存した件名" });
  const draft = await service.previewMessage("shop.notice", { channel: "email", values: { subject: "未保存", blocks: [{ type: "nope" }] } });
  assert.equal(draft.html, '<p><span data-field="subject">未保存</span></p>');
  // 通らない未保存の値(blocks)は重ねない
  const content = previews.at(-1)!.content as { values: { blocks: { text: string }[] } };
  assert.match(content.values.blocks[0].text, /一/);
  await rejectsWith(service.previewMessage("shop.notice", { channel: "line" }), 400);
});

test("管理者でなければ 403", async () => {
  const { service } = setup({ role: "user" });
  await rejectsWith(service.listMessages(), 403);
  await rejectsWith(service.saveField("shop.notice", { fieldPath: "subject", value: "x" }), 403);
  const anonymous = setup({ actorId: null });
  await rejectsWith(anonymous.service.getMessage("shop.notice"), 403);
});
