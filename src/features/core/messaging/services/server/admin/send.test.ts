// 管理の送信の service の検査(送る口・監査は偽物)
// - 中身は 1 つの形 { template(白紙 { system } か DB の { id, version }), values, edited?, vars? }(D117・D125、専用の値は vars 指令 58)を送る口 sendTemplateMessage へ、
//   宛先(全員・ロール・グループ・選んだ利用者)、予約、監査(sent / scheduled / test_sent)
// - カテゴリー(必須): 種別 announcement・direct・promotion だけ、宛先の種類は性質 adminFreeText。経路の制限は無い(LINE・fork の経路も)。
//   白紙の種別とカテゴリーの種別の照合は送る口(templateSend.test.ts)
// - プレビュー・テスト送信の宛先は操作した管理者、見込みは送る時に数え直す印つき、選択肢
// - グループ宛て(announcement・promotion・direct、D109 の漏れの直しで direct も。見込みは送る口のまま)、選択肢のグループ
// - 管理者でなければ 403
// 実行: pnpm test src/features/core/messaging/services/server/admin/send.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { MessageCategory, MessageChannel, MessageSystemTemplate } from "@/lib/messaging";
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
import { TEST_LAYOUTS } from "../sendMessage/testHelpers";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE = "11111111-1111-4111-8111-111111111111";
const categories: Record<string, MessageCategory> = {
  announcement: { key: "announcement", label: "運営からのお知らせ", kind: "announcement", channels: ["email", "inApp"] },
  operatorDirect: { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "inApp"] },
  promotion: { key: "promotion", label: "キャンペーン情報", kind: "promotion", channels: ["email", "inApp"] },
  promoPush: { key: "promoPush", label: "プッシュの宣伝", kind: "promotion", channels: ["email", "push"] },
  activity: { key: "activity", label: "アクティビティ", kind: "activity", channels: ["email", "inApp"] },
};
const result = { dispatchId: "d1", status: "processing" as const, deliveries: [], queuedCount: 0, channelCounts: {} };

const GROUP = "22222222-2222-4222-8222-222222222222";
const blank = (kind: MessageSystemTemplate["kind"]): MessageSystemTemplate => ({ key: kind, kind, label: `${kind} の白紙`, layout: "notice", values: { subject: "", blocks: [] } });
const systemTemplates: Record<string, MessageSystemTemplate> = { announcement: blank("announcement"), direct: blank("direct"), promotion: blank("promotion") };

function setup(options: { role?: string; actorId?: string | null; groups?: { id: string; label: string; kindLabel: string }[] } = {}) {
  const calls: { fn: string; args: unknown[] }[] = [];
  const audits: AuditRecordInput[] = [];
  const channel = (key: string, extra: Partial<MessageChannel> = {}): MessageChannel => ({
    key,
    label: key.toUpperCase(),
    addressing: "user",
    send: async () => [],
    ...extra,
  });
  const deps: AdminSendDeps = {
    context: () => ({ actorId: options.actorId === undefined ? ADMIN : options.actorId, actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    sendTemplateMessage: async (...args) => {
      calls.push({ fn: "template", args });
      return result;
    },
    previewMessage: async (...args) => {
      calls.push({ fn: "preview", args });
      return { messageKey: "messaging.template", kind: "promotion", category: "promotion", template: null, channels: [] };
    },
    estimateRecipients: async (...args) => {
      calls.push({ fn: "estimate", args });
      return { count: 7, fixedAtSend: true };
    },
    recordAudit: async (input) => audits.push(input),
    channels: { email: channel("email"), inApp: channel("inApp"), line: channel("line", { enabled: false }), push: channel("push") },
    categories,
    systemTemplates,
    layouts: TEST_LAYOUTS,
    enrichers: {},
    roles: () => [{ id: "user", label: "ユーザー" }],
    groupOptions: async () => options.groups ?? [],
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

const TEXT = { subject: "春 {{discount}}", blocks: [{ type: "paragraph", text: "本文" }] };
const TPL = { id: TEMPLATE, version: 3 };
const BLANK = { system: "announcement" };
const VALUES = { subject: "件名", blocks: [{ type: "paragraph", text: "{{displayName}} 様" }] };
/** その場で書く中身(白紙 + 欄の中身) */
const ADHOC = { template: BLANK, values: VALUES };

test("その場で書いた中身(白紙)を全員へ今送る: 送る口に白紙・欄の中身・カテゴリー、監査 sent", async () => {
  const { deps, calls, audits } = setup();
  const sent = await adminSend(deps, { ...ADHOC, category: "announcement", channels: ["email", "inApp"], target: { type: "all" } });
  assert.equal(sent.dispatchId, "d1");
  const [input] = calls[0].args as [Record<string, unknown>];
  assert.equal(calls[0].fn, "template");
  assert.deepEqual(input.template, BLANK);
  assert.deepEqual(input.values, VALUES);
  assert.equal(input.category, "announcement");
  assert.deepEqual(input.channels, ["email", "inApp"]);
  assert.equal("vars" in input, false);
  assert.equal("edited" in input, false);
  assert.deepEqual(input.target, { type: "all" });
  assert.equal(input.source, "messaging.adminSend");
  assert.equal(input.scheduledAt, undefined);
  assert.equal(audits[0].action, "messaging.dispatch.sent");
  assert.deepEqual([audits[0].metadata?.source, audits[0].metadata?.category, audits[0].metadata?.kind], ["system", "announcement", "announcement"]);
  // 経路を省略 = カテゴリーの経路の全部
  await adminSend(deps, { ...ADHOC, category: "promotion", target: { type: "role", roles: ["user"] } });
  assert.equal("channels" in (calls[1].args[0] as Record<string, unknown>), false);
});

test("DB のテンプレートをロール宛てに予約: 送る口に template・欄の中身・直した印・専用の値 vars・カテゴリー、監査 scheduled", async () => {
  const { deps, calls, audits } = setup();
  await adminSend(deps, {
    template: TPL,
    values: TEXT,
    edited: true,
    vars: { discount: 10 },
    category: "promotion",
    target: { type: "role", roles: ["user"] },
    scheduledAt: "2026-12-01T09:00:00+09:00",
  });
  const [input] = calls[0].args as [Record<string, unknown>];
  assert.deepEqual(input.template, TPL);
  assert.deepEqual(input.values, TEXT);
  assert.equal(input.edited, true);
  assert.deepEqual(input.vars, { discount: 10 });
  assert.equal(input.category, "promotion");
  assert.deepEqual(input.target, { type: "role", roles: ["user"] });
  assert.deepEqual(input.scheduledAt, new Date("2026-12-01T00:00:00Z"));
  assert.equal("channels" in input, false);
  assert.equal(audits[0].action, "messaging.dispatch.scheduled");
  assert.deepEqual([audits[0].metadata?.source, audits[0].metadata?.templateId, audits[0].metadata?.templateVersion], ["template", TEMPLATE, 3]);
});

test("カテゴリー: 無い・3 つの種別でない・宛先の種類が送れない は 400。経路の制限は無い", async () => {
  const { deps, calls } = setup();
  // direct は選んだ利用者・グループ宛てだけ(全員・ロールは 400)
  for (const target of [{ type: "all" }, { type: "role", roles: ["user"] }]) {
    await rejectsWith(adminSend(deps, { ...ADHOC, category: "operatorDirect", channels: ["email"], target }), 400, /この宛先/);
  }
  await rejectsWith(adminSend(deps, { ...ADHOC, category: "activity", target: { type: "all" } }), 400, /管理画面から送信できません/);
  await rejectsWith(adminSend(deps, { ...ADHOC, category: "nope", target: { type: "all" } }), 400, /見つかりません/);
  await rejectsWith(adminSend(deps, { ...ADHOC, channels: ["email"], target: { type: "all" } }), 400);
  assert.equal(calls.length, 0);
  // email・inApp の外の経路(push)を持つカテゴリーも白紙の中身で送る口へ(中身の検査は送る口)
  await adminSend(deps, { ...ADHOC, category: "promoPush", target: { type: "all" } });
  await adminSend(deps, { ...ADHOC, category: "operatorDirect", channels: ["email"], target: { type: "users", userIds: ["u1", "u1", "u2"] } });
  assert.equal((calls[0].args[0] as Record<string, unknown>).category, "promoPush");
  assert.deepEqual((calls[1].args[0] as Record<string, unknown>).recipients, [{ userId: "u1" }, { userId: "u2" }]);
});

test("入力の誤りは 400(形・知らない鍵・白紙での直した印・予約の形)", async () => {
  const { deps } = setup();
  const c = { category: "promotion", target: { type: "all" } };
  const cases = [
    { ...c },
    { ...c, template: BLANK },
    { ...c, template: BLANK, values: "文" },
    { ...c, values: VALUES },
    // 前の形(経路ごとの content)は黙って捨てない
    { ...c, ...ADHOC, content: { email: { subject: "s" } } },
    { ...c, ...ADHOC, edited: true },
    { ...c, ...ADHOC, template: { id: "not-uuid", version: 3 } },
    { ...c, ...ADHOC, template: { id: TEMPLATE } },
    { ...c, ...ADHOC, template: { templateId: TEMPLATE, version: 3 } },
    { ...c, ...ADHOC, scheduledAt: "あした" },
    { ...c, ...ADHOC, target: { type: "users", userIds: [] } },
    // 前の形(message の包み)・知らない鍵は黙って捨てない
    { ...c, message: { type: "adhoc", email: { subject: "s", body: "b" } } },
    { ...c, ...ADHOC, kind: "promotion" },
  ];
  for (const input of cases) await rejectsWith(adminSend(deps, input), 400);
});

test("プレビューとテスト送信は操作した管理者、テストは is_test で監査 test_sent", async () => {
  const { deps, calls, audits } = setup();
  await adminSendPreview(deps, { template: TPL, values: TEXT, vars: { a: 1 }, category: "promotion" });
  assert.deepEqual(calls[0].args, [
    { template: { template: TPL, values: TEXT, category: "promotion" } },
    { vars: { a: 1 }, channels: undefined, userId: ADMIN },
  ]);
  await adminSendPreview(deps, { ...ADHOC, category: "announcement", channels: ["email"] });
  assert.deepEqual(calls[1].args, [
    { template: { ...ADHOC, category: "announcement" } },
    { vars: {}, channels: ["email"], userId: ADMIN },
  ]);

  await adminSendTest(deps, { ...ADHOC, category: "operatorDirect", channels: ["email"] });
  const [input] = calls[2].args as [Record<string, unknown>];
  assert.equal(input.category, "operatorDirect");
  assert.deepEqual(input.recipients, [{ userId: ADMIN }]);
  assert.equal(input.isTest, true);
  assert.equal(input.source, "messaging.adminSend.test");
  assert.equal(audits.at(-1)?.action, "messaging.dispatch.test_sent");

  const system = setup({ actorId: null, role: "admin" });
  system.deps.context = () => ({ actorId: null, actorType: "system" }) as never;
  await rejectsWith(adminSendTest(system.deps, { ...ADHOC, category: "promotion", channels: ["email"] }), 400);
});

test("見込みは送る口の数(送る時に数え直す印)、選択肢は有効な経路・ロール・テンプレート", async () => {
  const { deps, calls } = setup();
  assert.deepEqual(await adminSendEstimate(deps, { target: { type: "users", userIds: ["u1", "u2"] } }), {
    count: 7,
    fixedAtSend: true,
  });
  assert.deepEqual(calls[0].args, [{ userIds: ["u1", "u2"] }]);
  await adminSendEstimate(deps, { target: { type: "role", roles: ["user"] } });
  assert.deepEqual(calls[1].args, [{ target: { type: "role", roles: ["user"] } }]);
  const options = await adminSendOptions(deps);
  assert.deepEqual(options.channels, [
    { key: "email", label: "EMAIL" },
    { key: "inApp", label: "INAPP" },
    { key: "push", label: "PUSH" },
  ]);
  // 3 つの種別のカテゴリー(受け口の順)と送れる宛先の種類・その種別の白紙
  assert.deepEqual(
    options.categories.map((o) => [o.key, o.kind, o.targets.join(",")]),
    [
      ["announcement", "announcement", "all,role,group,users"],
      ["operatorDirect", "direct", "users,bulk,group"],
      ["promotion", "promotion", "all,role,group,users,bulk"],
      ["promoPush", "promotion", "all,role,group,users,bulk"],
    ],
  );
  assert.deepEqual(options.categories.map((o) => o.systemTemplate?.key), ["announcement", "direct", "promotion", "promotion"]);
  assert.equal(options.maxScheduleDays, 90);
});

test("管理者でなければ 403", async () => {
  const { deps } = setup({ role: "user" });
  await rejectsWith(adminSend(deps, { ...ADHOC, category: "promotion", channels: ["email"], target: { type: "all" } }), 403);
  await rejectsWith(adminSendOptions(deps), 403);
});

test("グループ宛て: announcement・promotion・direct は送る口へ { type: group, groupId }、形の誤りは 400、見込みは送る口のまま、選択肢のグループ", async () => {
  const { deps, calls, audits } = setup({ groups: [{ id: GROUP, label: "常連", kindLabel: "固定(選んだ人)" }] });
  await adminSend(deps, { ...ADHOC, category: "announcement", target: { type: "group", groupId: GROUP } });
  assert.deepEqual((calls[0].args[0] as Record<string, unknown>).target, { type: "group", groupId: GROUP });
  assert.deepEqual(audits[0].metadata?.target, { type: "group", groupId: GROUP });
  await adminSend(deps, { ...ADHOC, category: "promotion", target: { type: "group", groupId: GROUP } });
  await adminSend(deps, { ...ADHOC, category: "operatorDirect", target: { type: "group", groupId: GROUP } });
  assert.equal(calls.length, 3);
  assert.deepEqual((calls[2].args[0] as Record<string, unknown>).target, { type: "group", groupId: GROUP });
  await rejectsWith(adminSend(deps, { ...ADHOC, category: "announcement", target: { type: "group", groupId: "x" } }), 400);
  assert.equal(calls.length, 3);

  await adminSendEstimate(deps, { target: { type: "group", groupId: GROUP } });
  assert.deepEqual(calls[3], { fn: "estimate", args: [{ target: { type: "group", groupId: GROUP } }] });

  const options = await adminSendOptions(deps);
  assert.deepEqual(options.groups, [{ id: GROUP, label: "常連", kindLabel: "固定(選んだ人)" }]);
  assert.ok(options.categories.find((category) => category.key === "announcement")!.targets.includes("group"));
  assert.ok(options.categories.find((category) => category.key === "operatorDirect")!.targets.includes("group"));
  // 門 userGroups が閉なら部品が空を返す(結びは index.ts)
  assert.deepEqual((await adminSendOptions(setup().deps)).groups, []);
});
