// 管理画面の文言の上書きの service の検査(DB・監査は偽物)
// - 一覧: 直せる欄(adminEditablePaths、既定は種類の経路の欄の全部・adminEditableOnly で絞る。D83)のある連絡(と行の残る連絡)、数
// - 直せない連絡(required・functional)は一覧に出ず 1 件は 404
// - 1 件: 欄ごとの管理画面の値・送る時の値・印、使ってよい {{鍵}}(秘密を除く)。コードの値は今は無い(null、TODO 指令 56)
// - プレビュー: 送る口と同じ組み立ての中身を経路の preview で描く(上書きは重ねない、TODO 指令 56)
// - 保存: 送る口と同じ検査(誤りは 400)、直した時のコードの値と操作者を残し、監査に残す / 戻す = 行を消す(無ければ 404)
// - 管理者でなければ 403
// 実行: pnpm test src/features/core/messaging/services/server/overrides
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { resolveMessageDefinition, defineMessage, secretVar } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { createOverrideService } from "./overrideService";
import type { MessageOverrideRecord } from "./types";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const editable = resolveMessageDefinition(
  defineMessage({
    key: "shop.notice",
    label: "テストの連絡",
    category: "shop",
    vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
    adminEditableOnly: ["email.subject", "email.paragraphs"],
    layout: "notice",
    values: { subject: "{{name}} 様へ", blocks: [{ type: "paragraph", text: "一" }] },
  }),
  undefined,
  { kind: "transactional", channels: ["email"] },
) as unknown as AnyResolvedMessageDefinition;

// 直せない連絡(D83 の後は絞りの無い連絡も全部の欄を直せるので、直せない例は required)
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
    channelInfo: () => null,
    loadDefinition: async (key) => (definitions[key] ? { resolved: definitions[key], check: { variableKeys: ["displayName"] } } : null),
    store: {
      listByMessage: async (key) => rows.filter((row) => row.messageKey === key),
      listAll: async () => [...rows],
      upsert: async ({ messageKey, fieldPath, value, codeValue, updatedBy }) => {
        const index = rows.findIndex((row) => row.messageKey === messageKey && row.fieldPath === fieldPath);
        const row = { messageKey, fieldPath, value, codeValue, updatedBy, updatedAt: new Date("2026-11-12T00:00:00Z") };
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
    channelContent: async (resolved, channel) => ({ title: `${resolved.key} ${channel}` }),
    channelPreview: async (channel, input) => (previews.push({ channel, content: input.content }), { html: "<p>描いた</p>" }),
  });
  return { service, rows, audits, previews };
}

const row = (fieldPath: string, value: unknown, codeValue: unknown): MessageOverrideRecord => ({
  messageKey: "shop.notice",
  fieldPath,
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

test("一覧: 直せる欄のある連絡だけ、数を返す", async () => {
  const { service } = setup({
    rows: [row("email.subject", "{{nope}}", "{{name}} 様へ"), row("email.paragraphs", ["a", "b"], ["旧", "旧"])],
  });
  assert.deepEqual(await service.listMessages(), [
    { key: "shop.notice", label: "テストの連絡", kind: "transactional", category: "shop", categoryLabel: null, channels: [], editableCount: 2, editedCount: 2, orphanCount: 1, codeChangedCount: 2 },
  ]);
});

test("1 件: 欄ごとの値と印、使ってよい鍵(秘密を除く)、直せなくなった欄の行も出す。コードの値は今は無い", async () => {
  const { service } = setup({
    rows: [
      row("email.subject", "新しい {{name}}", "{{name}} 様へ"),
      row("email.paragraphs", ["a"], ["一"]),
      row("email.heading", "見出し", null),
    ],
  });
  const detail = await service.getMessage("shop.notice");
  assert.deepEqual(detail.allowedKeys, ["name", "recipientName", "recipientEmail", "serviceName", "appBaseUrl", "displayName"]);
  const [subject, paragraphs, heading] = detail.fields;
  assert.deepEqual(
    { ...subject, updatedAt: null },
    { path: "email.subject", channel: "email", field: "subject", meta: { label: "subject", input: "line" }, editable: true, codeValue: null, value: "新しい {{name}}", effective: "新しい {{name}}", edited: true, codeChanged: true, orphan: false, problem: null, updatedAt: null },
  );
  // コードの値が無いので並びの数は見ない。直した時のコードの値と違う = コードが変わった
  assert.equal(paragraphs.orphan, false);
  assert.deepEqual(paragraphs.effective, ["a"]);
  assert.equal(paragraphs.codeChanged, true);
  assert.equal(heading.editable, false);
  assert.equal(heading.orphan, true);
});

test("保存: 検査を通った値だけ、コードの値と操作者を残し監査に残す。戻すは行を消す", async () => {
  const { service, rows, audits } = setup();
  const detail = await service.saveField("shop.notice", { fieldPath: "email.subject", value: "{{displayName}} 様、{{serviceName}} です" });
  assert.equal(detail.fields[0].effective, "{{displayName}} 様、{{serviceName}} です");
  assert.deepEqual(rows.map((r) => [r.fieldPath, r.codeValue, r.updatedBy]), [["email.subject", null, ADMIN]]);
  assert.deepEqual(audits.map((a) => [a.action, a.targetId]), [["messaging.override.updated", "shop.notice:email.subject"]]);

  const reset = await service.resetField("shop.notice", "email.subject");
  assert.equal(rows.length, 0);
  assert.equal(reset.fields[0].edited, false);
  assert.equal(audits[1].action, "messaging.override.reset");
  await rejectsWith(service.resetField("shop.notice", "email.subject"), 404);
});

test("保存の誤り: 入力・直せない欄・型・使えない鍵・秘密の鍵は 400、無い連絡は 404", async () => {
  const { service, rows, audits } = setup();
  for (const input of [
    null,
    { fieldPath: "email.subject" , value: "x", extra: 1 },
    { fieldPath: "email.cta", value: { label: "a", url: "b" } },
    { fieldPath: "email.subject", value: "" },
    { fieldPath: "email.subject", value: "{{nope}}" },
    { fieldPath: "email.subject", value: "{{token}}" },
  ]) {
    await rejectsWith(service.saveField("shop.notice", input), 400);
  }
  await rejectsWith(service.saveField("shop.none", { fieldPath: "email.subject", value: "x" }), 404);
  await rejectsWith(service.getMessage("shop.plain"), 404);
  assert.equal(rows.length, 0);
  assert.equal(audits.length, 0);
});

test("プレビュー: 送る口と同じ組み立ての中身を経路の preview で描き、上書きは重ねない(指令 56 まで)", async () => {
  const { service, previews } = setup({ rows: [row("email.subject", "直した件名", null)] });
  const preview = await service.previewMessage("shop.notice", { channel: "email", values: { "email.subject": "未保存" } });
  assert.deepEqual(preview, { channel: "email", html: "<p>描いた</p>", text: null });
  assert.deepEqual(previews, [{ channel: "email", content: { title: "shop.notice email" } }]);
  await rejectsWith(service.previewMessage("shop.notice", { channel: "inApp" }), 400);
});

test("管理者でなければ 403", async () => {
  const { service } = setup({ role: "user" });
  await rejectsWith(service.listMessages(), 403);
  await rejectsWith(service.saveField("shop.notice", { fieldPath: "email.subject", value: "x" }), 403);
  const anonymous = setup({ actorId: null });
  await rejectsWith(anonymous.service.getMessage("shop.notice"), 403);
});
