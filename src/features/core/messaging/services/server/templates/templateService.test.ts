// 保存されたテンプレートの service の検査(DB・台帳・監査は偽物)
// - 作る(draft)・下書きの更新・公開(版を追記、版は不変、current_version を進める)・取り下げ・版の一覧と 1 版・監査
// - 保存時の検査: 経路の欄・種類・変数の宣言(一意・予約の鍵・secret の型)・{{鍵}} は共通の文脈 ∪ provides ∪ 変数だけ
// - 画面の選択肢(有効な経路・種類・基本の鍵)
// - 変更の無い公開・取り下げ済みの操作は 409、同じ鍵は 409、管理者でなければ 403
// 実行: pnpm test src/features/core/messaging/services/server/templates
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { MessageCategory, MessageChannel } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageTemplate, MessageTemplateVersion } from "../../../entities/model";
import { createTemplateService } from "./templateService";
import type { MessageTemplateStore } from "./types";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const channels: Record<string, MessageChannel> = {
  email: {
    key: "email",
    label: "メール",
    addressing: "user",
    fields: z.object({ subject: z.string().min(1), paragraphs: z.array(z.string()).optional() }).strict(),
    send: async () => [],
  },
  inApp: {
    key: "inApp",
    label: "お知らせ",
    addressing: "user",
    fields: z.object({ title: z.string().min(1), body: z.string(), image: z.string().optional() }).strict(),
    send: async () => [],
  },
  line: { key: "line", label: "LINE", addressing: "user", enabled: false, fields: z.object({ text: z.string() }), send: async () => [] },
};
const categories: Record<string, MessageCategory> = { marketing: { key: "marketing", label: "お知らせ", kind: "marketing", channels: ["email", "inApp"] } };

function setup(options: { role?: string } = {}) {
  const templates: MessageTemplate[] = [];
  const versions: MessageTemplateVersion[] = [];
  const audits: AuditRecordInput[] = [];
  let clock = 0;
  const store: MessageTemplateStore<null> = {
    transaction: (run) => run(null),
    list: async ({ status, limit }) =>
      templates
        .filter((row) => !status || row.status === status)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit + 1),
    find: async (id) => templates.find((row) => row.id === id) ?? null,
    findByKey: async (key) => templates.find((row) => row.key === key) ?? null,
    lockForUpdate: async (_tx, id) => templates.find((row) => row.id === id) ?? null,
    insert: async (_tx, values) => {
      const row = {
        id: randomUUID(),
        description: null,
        current_version: null,
        created_by: null,
        updated_by: null,
        createdAt: new Date(Date.UTC(2026, 10, 12, 0, 0, clock++)),
        updatedAt: null,
        status: "draft",
        variables: [],
        ...values,
      } as MessageTemplate;
      templates.push(row);
      return row;
    },
    update: async (_tx, id, patch) => {
      const row = templates.find((item) => item.id === id)!;
      Object.assign(row, patch, { updatedAt: new Date() });
      return row;
    },
    latestVersion: async (id) =>
      versions.filter((row) => row.template_id === id).sort((a, b) => b.version - a.version)[0] ?? null,
    insertVersion: async (_tx, values) => {
      const row = { id: randomUUID(), variables: [], edited_by: null, createdAt: new Date(), ...values } as MessageTemplateVersion;
      versions.push(row);
      return row;
    },
    listVersions: async (id) => versions.filter((row) => row.template_id === id).sort((a, b) => b.version - a.version),
    findVersion: async (id, version) => versions.find((row) => row.template_id === id && row.version === version) ?? null,
  };
  const service = createTemplateService({
    store,
    ledger: { find: async () => null, attach: async () => {}, copy: async (ref) => ref },
    check: () => ({ channels, categories, providedKeys: ["displayName"] }),
    context: () => ({ actorId: ADMIN, actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    recordAudit: async (input) => audits.push(input),
  });
  return { service, templates, versions, audits };
}

const input = (extra: Record<string, unknown> = {}) => ({
  key: "spring-sale",
  name: "春のセール",
  category: "marketing",
  channels: ["email", "inApp"],
  content: {
    email: { subject: "{{displayName}} 様へ {{discount}} 割引", paragraphs: ["{{serviceName}} より"] },
    inApp: { title: "セール", body: "{{discount}} 割引" },
  },
  variables: [{ key: "discount", label: "割引", type: "string", required: true, source: "dispatch" }],
  ...extra,
});

async function rejectsWith(run: Promise<unknown>, status: number, message?: RegExp) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    if (message) assert.match(error.message, message);
    return true;
  });
}

test("作る → 公開 → 直す → 公開: 版は不変で current_version が進み、監査に残る", async () => {
  const { service, versions, audits } = setup();
  const created = await service.createTemplate(input());
  assert.equal(created.status, "draft");
  assert.equal(created.currentVersion, null);
  assert.equal(created.hasUnpublishedChanges, true);
  assert.deepEqual(created.allowedKeys, ["recipientName", "recipientEmail", "serviceName", "appBaseUrl", "displayName", "discount"]);
  assert.equal(created.createdBy, ADMIN);

  const published = await service.publishTemplate(created.id);
  assert.equal(published.status, "published");
  assert.equal(published.currentVersion, 1);
  assert.equal(published.hasUnpublishedChanges, false);
  assert.deepEqual(versions[0].channels, ["email", "inApp"]);
  assert.equal(versions[0].category, "marketing");
  assert.equal(versions[0].variables[0].key, "discount");

  const edited = await service.updateTemplate(created.id, { content: { email: { subject: "新しい件名" }, inApp: { title: "t", body: "b" } } });
  assert.equal(edited.hasUnpublishedChanges, true);
  assert.equal(edited.currentVersion, 1);
  // 公開した版は書き換わらない
  const v1 = await service.getTemplateVersion(created.id, 1);
  assert.equal((v1.content.email as { subject: string }).subject, "{{displayName}} 様へ {{discount}} 割引");

  const second = await service.publishTemplate(created.id);
  assert.equal(second.currentVersion, 2);
  assert.deepEqual((await service.listTemplateVersions(created.id)).map((v) => v.version), [2, 1]);
  assert.deepEqual(audits.map((a) => a.action), [
    "messaging.template.created",
    "messaging.template.published",
    "messaging.template.updated",
    "messaging.template.published",
  ]);
  assert.deepEqual(audits[1].metadata, { key: "spring-sale", version: 1 });
});

test("変更の無い公開は 409、取り下げた後は直せない・公開できない(409)", async () => {
  const { service, audits } = setup();
  const created = await service.createTemplate(input());
  await service.publishTemplate(created.id);
  await rejectsWith(service.publishTemplate(created.id), 409, /変更が無い/);
  const archived = await service.archiveTemplate(created.id);
  assert.equal(archived.status, "archived");
  await rejectsWith(service.updateTemplate(created.id, { name: "x" }), 409);
  await rejectsWith(service.publishTemplate(created.id), 409);
  await rejectsWith(service.archiveTemplate(created.id), 409);
  assert.equal(audits.at(-1)?.action, "messaging.template.archived");
  assert.equal((await service.listTemplateVersions(created.id)).length, 1);
});

test("保存時の検査(400)と同じ鍵(409)", async () => {
  const { service, templates } = setup();
  const cases: Record<string, unknown>[] = [
    { key: "Bad Key" },
    { category: "nope" },
    { channels: ["email", "line"] },
    { channels: ["email"] },
    { content: { email: { subject: "" }, inApp: { title: "t", body: "b" } } },
    { content: { email: { subject: "{{unknown}}" }, inApp: { title: "t", body: "b" } } },
    { variables: [{ key: "serviceName", label: "x", type: "string", required: true, source: "dispatch" }] },
    { variables: [{ key: "displayName", label: "x", type: "string", required: true, source: "dispatch" }] },
    { variables: [{ key: "token", label: "x", type: "secret", required: true, source: "dispatch" }] },
    {
      variables: [
        { key: "discount", label: "x", type: "string", required: true, source: "dispatch" },
        { key: "discount", label: "y", type: "string", required: false, source: "recipient" },
      ],
    },
    { variables: [{ key: "bad-key", label: "x", type: "string", required: true, source: "dispatch" }] },
    { variables: [{ key: "discount" }] },
  ];
  for (const extra of cases) await rejectsWith(service.createTemplate(input(extra)), 400);
  assert.equal(templates.length, 0);
  await service.createTemplate(input());
  await rejectsWith(service.createTemplate(input()), 409);
  await rejectsWith(service.updateTemplate(templates[0].id, { content: { email: { subject: "{{nope}}" }, inApp: { title: "t", body: "b" } } }), 400);
});

test("一覧(状態で絞る・cursor)、無い id は 404、版の番号の誤りは 400", async () => {
  const { service } = setup();
  const a = await service.createTemplate(input({ key: "a" }));
  await service.createTemplate(input({ key: "b" }));
  await service.publishTemplate(a.id);
  const page = await service.listTemplates({ limit: "1" });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].key, "b");
  assert.ok(page.nextCursor);
  assert.deepEqual((await service.listTemplates({ status: "published" })).items.map((t) => t.key), ["a"]);
  await rejectsWith(service.listTemplates({ status: "nope" }), 400);
  await rejectsWith(service.getTemplate(randomUUID()), 404);
  await rejectsWith(service.listTemplateVersions(randomUUID()), 404);
  await rejectsWith(service.getTemplateVersion(a.id, 0), 400);
  await rejectsWith(service.getTemplateVersion(a.id, 9), 404);
});

test("画面の選択肢: 有効な経路だけ・種類・変数の前から使える鍵", async () => {
  const { service } = setup();
  const options = await service.templateOptions();
  assert.deepEqual(options.channels, [
    { key: "email", label: "メール" },
    { key: "inApp", label: "お知らせ" },
  ]);
  assert.deepEqual(options.categories, [{ key: "marketing", label: "お知らせ", description: null }]);
  assert.ok(options.baseAllowedKeys.includes("serviceName"));
  assert.ok(options.baseAllowedKeys.includes("displayName"));
  assert.ok(!options.baseAllowedKeys.includes("discount"));
});

test("管理者でなければ 403", async () => {
  const { service } = setup({ role: "user" });
  await rejectsWith(service.templateOptions(), 403);
  await rejectsWith(service.listTemplates(), 403);
  await rejectsWith(service.createTemplate(input()), 403);
});
