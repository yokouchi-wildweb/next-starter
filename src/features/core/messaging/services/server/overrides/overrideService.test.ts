// 管理画面の文言の上書きの service の検査(DB・監査は偽物)
// - 一覧: adminEditable のある連絡(と行の残る連絡)、数(直した・孤立・コードが変わった)
// - 1 件: 欄ごとのコードの値・管理画面の値・送る時の値・印、使ってよい {{鍵}}(秘密を除く)
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
    category: "shop",
    vars: z.object({ name: z.string(), token: secretVar(z.string()) }),
    adminEditable: ["email.subject", "email.paragraphs"],
    content: { email: { subject: "{{name}} 様へ", paragraphs: ["一", "二"], cta: { label: "開く", url: "{{token}}" } } },
  }),
  undefined,
  { kind: "transactional", channels: ["email"] },
) as unknown as AnyResolvedMessageDefinition;

const plain = resolveMessageDefinition(
  defineMessage({
    key: "shop.plain",
    category: "shop",
    vars: z.object({}),
    content: { email: { subject: "件名" } },
  }),
  undefined,
  { kind: "transactional", channels: ["email"] },
) as unknown as AnyResolvedMessageDefinition;

function setup(options: { actorId?: string | null; role?: string; rows?: MessageOverrideRecord[] } = {}) {
  const rows: MessageOverrideRecord[] = [...(options.rows ?? [])];
  const audits: AuditRecordInput[] = [];
  const definitions: Record<string, AnyResolvedMessageDefinition> = { "shop.notice": editable, "shop.plain": plain };
  const service = createOverrideService({
    context: () => ({ actorId: options.actorId === undefined ? ADMIN : options.actorId, actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    messageKeys: () => Object.keys(definitions),
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
  });
  return { service, rows, audits };
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

test("一覧: adminEditable のある連絡だけ、数を返す", async () => {
  const { service } = setup({
    rows: [row("email.subject", "{{nope}}", "{{name}} 様へ"), row("email.paragraphs", ["a", "b"], ["旧", "旧"])],
  });
  assert.deepEqual(await service.listMessages(), [
    { key: "shop.notice", kind: "transactional", category: "shop", editableCount: 2, editedCount: 2, orphanCount: 1, codeChangedCount: 1 },
  ]);
});

test("1 件: 欄ごとの値と印、使ってよい鍵(秘密を除く)、直せなくなった欄の行も出す", async () => {
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
    { path: "email.subject", editable: true, codeValue: "{{name}} 様へ", value: "新しい {{name}}", effective: "新しい {{name}}", edited: true, codeChanged: false, orphan: false, problem: null, updatedAt: null },
  );
  // 並びの数が違う = 孤立(送る時はコードの値)、直した時のコードの値と違う = コードが変わった
  assert.equal(paragraphs.orphan, true);
  assert.deepEqual(paragraphs.effective, ["一", "二"]);
  assert.equal(paragraphs.codeChanged, true);
  assert.equal(heading.editable, false);
  assert.equal(heading.orphan, true);
});

test("保存: 検査を通った値だけ、コードの値と操作者を残し監査に残す。戻すは行を消す", async () => {
  const { service, rows, audits } = setup();
  const detail = await service.saveField("shop.notice", { fieldPath: "email.subject", value: "{{displayName}} 様、{{serviceName}} です" });
  assert.equal(detail.fields[0].effective, "{{displayName}} 様、{{serviceName}} です");
  assert.deepEqual(rows.map((r) => [r.fieldPath, r.codeValue, r.updatedBy]), [["email.subject", "{{name}} 様へ", ADMIN]]);
  assert.deepEqual(audits.map((a) => [a.action, a.targetId]), [["messaging.override.updated", "shop.notice:email.subject"]]);

  const reset = await service.resetField("shop.notice", "email.subject");
  assert.equal(rows.length, 0);
  assert.equal(reset.fields[0].edited, false);
  assert.equal(audits[1].action, "messaging.override.reset");
  await rejectsWith(service.resetField("shop.notice", "email.subject"), 404);
});

test("保存の誤り: 入力・直せない欄・型・並びの数・使えない鍵・秘密の鍵は 400、無い連絡は 404", async () => {
  const { service, rows, audits } = setup();
  for (const input of [
    null,
    { fieldPath: "email.subject" , value: "x", extra: 1 },
    { fieldPath: "email.cta", value: { label: "a", url: "b" } },
    { fieldPath: "email.subject", value: "" },
    { fieldPath: "email.paragraphs", value: ["a"] },
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

test("管理者でなければ 403", async () => {
  const { service } = setup({ role: "user" });
  await rejectsWith(service.listMessages(), 403);
  await rejectsWith(service.saveField("shop.notice", { fieldPath: "email.subject", value: "x" }), 403);
  const anonymous = setup({ actorId: null });
  await rejectsWith(anonymous.service.getMessage("shop.notice"), 403);
});
