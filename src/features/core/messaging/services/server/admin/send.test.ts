// 管理の送信の service の検査(送る口・監査は偽物)
// - テンプレート / その場で書く連絡、宛先(全員・ロール・audiences・選んだ利用者)、予約、監査(sent / scheduled / test_sent)
// - カテゴリー(必須): 種別 announcement・direct・marketing だけ、宛先の種類は性質 adminFreeText、その場で書く連絡は email・inApp のカテゴリーだけ
// - プレビュー・テスト送信の宛先は操作した管理者、見込みは送る時に数え直す印つき、選択肢
// - 管理者でなければ 403
// 実行: pnpm test src/features/core/messaging/services/server/admin/send.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { MessageCategory, MessageChannel } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import {
  adminSend,
  adminSendEstimate,
  adminSendOptions,
  adminSendPreview,
  adminSendTest,
  type AdminSendDeps,
} from "./send";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE = "11111111-1111-4111-8111-111111111111";
const categories: Record<string, MessageCategory> = {
  announcement: { key: "announcement", label: "運営からのお知らせ", kind: "announcement", channels: ["email", "inApp"] },
  operatorDirect: { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "inApp"] },
  marketing: { key: "marketing", label: "キャンペーン情報", kind: "marketing", channels: ["email", "inApp"] },
  promoPush: { key: "promoPush", label: "プッシュの宣伝", kind: "marketing", channels: ["email", "push"] },
  activity: { key: "activity", label: "アクティビティ", kind: "activity", channels: ["email", "inApp"] },
};
const result = { dispatchId: "d1", status: "processing" as const, deliveries: [], queuedCount: 0, channelCounts: {} };

function setup(options: { role?: string; actorId?: string | null } = {}) {
  const calls: { fn: string; args: unknown[] }[] = [];
  const audits: AuditRecordInput[] = [];
  const channel = (key: string, extra: Partial<MessageChannel> = {}): MessageChannel => ({
    key,
    label: key.toUpperCase(),
    addressing: "user",
    fields: z.object({}),
    send: async () => [],
    ...extra,
  });
  const deps: AdminSendDeps = {
    context: () => ({ actorId: options.actorId === undefined ? ADMIN : options.actorId, actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    sendMessageToMany: async (...args) => {
      calls.push({ fn: "many", args });
      return result;
    },
    sendTemplate: async (...args) => {
      calls.push({ fn: "template", args });
      return { ...result, status: "scheduled" };
    },
    previewMessage: async (...args) => {
      calls.push({ fn: "preview", args });
      return { messageKey: "messaging.adminMarketing", kind: "marketing", category: "marketing", template: null, channels: [] };
    },
    estimateRecipients: async (...args) => {
      calls.push({ fn: "estimate", args });
      return { count: 7, capped: false, fixedAtSend: true };
    },
    recordAudit: async (input) => audits.push(input),
    serviceNameShort: () => "サービス",
    channels: { email: channel("email"), inApp: channel("inApp"), line: channel("line", { enabled: false }), push: channel("push") },
    categories,
    audiences: { buyers: { key: "buyers", label: "購入者", args: z.object({}), resolveUserIds: async () => ({ userIds: [], nextCursor: null }) } },
    roles: () => [{ id: "user", label: "ユーザー" }],
    listPublishedTemplates: async () => [],
    maxScheduleDays: () => 90,
  };
  return { deps, calls, audits };
}

async function rejectsWith(run: Promise<unknown>, status: number, message?: RegExp) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    if (message) assert.match(error.message, message);
    return true;
  });
}

const TEXT = { email: { subject: "春 {{discount}}" }, inApp: { title: "春", body: "本文" } };
const tpl = (extra: Record<string, unknown> = {}) => ({ type: "template", templateId: TEMPLATE, version: 3, content: TEXT, ...extra });
const adhoc = { type: "adhoc", email: { subject: "件名", body: "本文" }, inApp: { title: "題", body: "本文" } };

test("その場で書く連絡を全員へ今送る: カテゴリーの種別の定義をそのカテゴリーで、監査 sent", async () => {
  const { deps, calls, audits } = setup();
  const sent = await adminSend(deps, { message: adhoc, category: "announcement", channels: ["email", "inApp"], audience: { type: "all" } });
  assert.equal(sent.dispatchId, "d1");
  const [definition, input] = calls[0].args as [{ key: string; category: string }, Record<string, unknown>];
  assert.equal(calls[0].fn, "many");
  assert.equal(definition.key, "messaging.adminAnnouncement");
  assert.equal(definition.category, "announcement");
  assert.deepEqual(input.audience, { type: "all" });
  assert.deepEqual(input.vars, { subject: "件名", body: "本文", inAppTitle: "題", inAppBody: "本文", serviceNameShort: "サービス" });
  assert.equal(input.source, "messaging.adminSend");
  assert.equal(input.scheduledAt, undefined);
  assert.equal(audits[0].action, "messaging.dispatch.sent");
  assert.deepEqual([audits[0].metadata?.category, audits[0].metadata?.kind], ["announcement", "announcement"]);
  // 経路を省略 = カテゴリーの経路の全部(中身はそろっている)
  await adminSend(deps, { message: adhoc, category: "marketing", audience: { type: "role", roles: ["user"] } });
  const [marketing, second] = calls[1].args as [{ key: string; category: string }, Record<string, unknown>];
  assert.deepEqual([marketing.key, marketing.category, second.channels], ["messaging.adminMarketing", "marketing", undefined]);
});

test("テンプレートを audiences の項目へ予約: sendTemplate に選んだカテゴリー、監査 scheduled", async () => {
  const { deps, calls, audits } = setup();
  await adminSend(deps, {
    message: tpl({ vars: { discount: 10 } }),
    category: "marketing",
    audience: { type: "audience", key: "buyers", args: { days: 30 } },
    scheduledAt: "2026-12-01T09:00:00+09:00",
  });
  const [input] = calls[0].args as [Record<string, unknown>];
  assert.equal(calls[0].fn, "template");
  assert.equal(input.templateId, TEMPLATE);
  // 読み込んだ版と送る文言(直した文面)をそのまま送る口へ(D85)
  assert.equal(input.version, 3);
  assert.deepEqual(input.content, TEXT);
  assert.deepEqual(input.vars, { discount: 10 });
  assert.equal(input.category, "marketing");
  assert.deepEqual(input.audience, { type: "audience", key: "buyers", args: { days: 30 } });
  assert.deepEqual(input.scheduledAt, new Date("2026-12-01T00:00:00Z"));
  assert.equal("channels" in input, false);
  assert.equal(audits[0].action, "messaging.dispatch.scheduled");
});

test("カテゴリー: 無い・3 つの種別でない・宛先の種類が送れない・その場で書けない経路は 400", async () => {
  const { deps, calls } = setup();
  // direct は選んだ利用者宛てだけ(全員・ロール・audiences は 400)
  for (const audience of [{ type: "all" }, { type: "role", roles: ["user"] }, { type: "audience", key: "buyers" }]) {
    await rejectsWith(adminSend(deps, { message: adhoc, category: "operatorDirect", channels: ["email"], audience }), 400, /この宛先/);
  }
  await rejectsWith(adminSend(deps, { message: adhoc, category: "activity", audience: { type: "all" } }), 400, /管理画面から送れません/);
  await rejectsWith(adminSend(deps, { message: adhoc, category: "nope", audience: { type: "all" } }), 400, /ありません/);
  await rejectsWith(adminSend(deps, { message: adhoc, category: "promoPush", audience: { type: "all" } }), 400, /その場で書く連絡では送れません/);
  await rejectsWith(adminSend(deps, { message: adhoc, channels: ["email"], audience: { type: "all" } }), 400);
  assert.equal(calls.length, 0);
  // テンプレートは版の経路なので email・inApp の外のカテゴリーでも送る口に渡す
  await adminSend(deps, { message: tpl(), category: "promoPush", audience: { type: "all" } });
  await adminSend(deps, { message: adhoc, category: "operatorDirect", channels: ["email"], audience: { type: "users", userIds: ["u1", "u1", "u2"] } });
  const [definition, input] = calls[1].args as [{ key: string; category: string }, Record<string, unknown>];
  assert.deepEqual([definition.key, definition.category], ["messaging.adminDirect", "operatorDirect"]);
  assert.deepEqual(input.recipients, [{ userId: "u1" }, { userId: "u2" }]);
});

test("入力の誤りは 400(経路・中身・予約の形)", async () => {
  const { deps } = setup();
  const c = { category: "marketing" };
  const cases = [
    { ...c, message: { type: "adhoc", email: { subject: "s", body: "b" } }, audience: { type: "all" } },
    { ...c, message: adhoc, channels: ["push"], audience: { type: "all" } },
    { ...c, message: { type: "adhoc", inApp: { title: "t", body: "b" } }, channels: ["email"], audience: { type: "all" } },
    { ...c, message: adhoc, channels: ["email"], audience: { type: "all" }, scheduledAt: "あした" },
    { ...c, message: tpl({ templateId: "not-uuid" }), audience: { type: "all" } },
    // 版と文言は必須(読み込んだ版の文言を送る)
    { ...c, message: { type: "template", templateId: TEMPLATE, content: TEXT }, audience: { type: "all" } },
    { ...c, message: { type: "template", templateId: TEMPLATE, version: 3 }, audience: { type: "all" } },
    { ...c, message: adhoc, channels: ["email"], audience: { type: "users", userIds: [] } },
    { ...c, message: adhoc, channels: ["email"], audience: { type: "all" }, kind: "marketing" },
  ];
  for (const input of cases) await rejectsWith(adminSend(deps, input), 400);
});

test("プレビューとテスト送信は操作した管理者、テストは is_test で監査 test_sent", async () => {
  const { deps, calls, audits } = setup();
  await adminSendPreview(deps, { message: tpl({ vars: { a: 1 } }), category: "marketing" });
  assert.deepEqual(calls[0].args, [
    { templateId: TEMPLATE, version: 3, content: TEXT, category: "marketing" },
    { vars: { a: 1 }, channels: undefined, userId: ADMIN },
  ]);
  await adminSendPreview(deps, { message: adhoc, category: "announcement", channels: ["email"] });
  assert.equal((calls[1].args[1] as { userId: string }).userId, ADMIN);

  await adminSendTest(deps, { message: adhoc, category: "operatorDirect", channels: ["email"] });
  const [definition, input] = calls[2].args as [{ category: string }, Record<string, unknown>];
  assert.equal(definition.category, "operatorDirect");
  assert.deepEqual(input.recipients, [{ userId: ADMIN }]);
  assert.equal(input.isTest, true);
  assert.equal(input.source, "messaging.adminSend.test");
  assert.equal(audits.at(-1)?.action, "messaging.dispatch.test_sent");

  const system = setup({ actorId: null, role: "admin" });
  system.deps.context = () => ({ actorId: null, actorType: "system" }) as never;
  await rejectsWith(adminSendTest(system.deps, { message: adhoc, category: "marketing", channels: ["email"] }), 400);
});

test("見込みは送る口の数(送る時に数え直す印)、選択肢は有効な経路・ロール・audiences・テンプレート", async () => {
  const { deps, calls } = setup();
  assert.deepEqual(await adminSendEstimate(deps, { audience: { type: "users", userIds: ["u1", "u2"] } }), {
    count: 7,
    capped: false,
    fixedAtSend: true,
  });
  assert.deepEqual(calls[0].args, [{ userIds: ["u1", "u2"] }]);
  await adminSendEstimate(deps, { audience: { type: "role", roles: ["user"] } });
  assert.deepEqual(calls[1].args, [{ audience: { type: "role", roles: ["user"] } }]);
  const options = await adminSendOptions(deps);
  assert.deepEqual(options.channels, [
    { key: "email", label: "EMAIL", adhoc: true },
    { key: "inApp", label: "INAPP", adhoc: true },
    { key: "push", label: "PUSH", adhoc: false },
  ]);
  assert.deepEqual(options.audiences, [{ key: "buyers", label: "購入者" }]);
  // 3 つの種別のカテゴリー(受け口の順)、送れる宛先の種類、その場で書けるか
  assert.deepEqual(
    options.categories.map((o) => [o.key, o.kind, o.audiences.join(","), o.adhoc]),
    [
      ["announcement", "announcement", "all,role,audience,users", true],
      ["operatorDirect", "direct", "users,bulk", true],
      ["marketing", "marketing", "all,role,audience,users,bulk", true],
      ["promoPush", "marketing", "all,role,audience,users,bulk", false],
    ],
  );
  assert.equal(options.maxScheduleDays, 90);
});

test("管理者でなければ 403", async () => {
  const { deps } = setup({ role: "user" });
  await rejectsWith(adminSend(deps, { message: adhoc, category: "marketing", channels: ["email"], audience: { type: "all" } }), 403);
  await rejectsWith(adminSendOptions(deps), 403);
});
