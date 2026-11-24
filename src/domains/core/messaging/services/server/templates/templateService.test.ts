// 保存されたテンプレートの service の検査(DB・台帳・監査は偽物)
// - 保存 = 公開(D134): 作る = 行と版 1、直す = 中身が最新の版と違えば新しい版、同じなら版を作らず unchanged(名前・説明だけも)。版は不変
// - 中身 = カテゴリー + レイアウト + 欄の中身 + 専用の埋め込み情報の宣言(指令 58)。レイアウトを替える時は新しいレイアウトの欄の中身も要る(D113)
// - 保存時の検査(400): カテゴリー(種別 announcement・direct・promotion だけ)・レイアウト(受け口にあり管理者が選べる)・欄の中身(そのカテゴリーの送信チャンネルで使う欄の zod)・
//   専用の宣言の形・名前の重なり(共通・enrichers・専用、D126)・文面の {{名前}} は一覧の中だけ。鍵はサーバーが作る
// - 消す(D137): 行が消え(版は cascade)、欄の中身を残している送信が使う画像はその送信に結び直す。監査 deleted(名前・最後の版)
// - 一覧(新しい順・cursor・種別で絞る D135・文字検索 q = 名前か欄の中身の文字列)、画面の選択肢(使える送信チャンネル・3 つの種別のカテゴリー・選べるレイアウト・基本の埋め込み情報)
// - テンプレートは DB の物だけ(システムテンプレートは廃止、D171): 一覧に system・kind の項目は無い、uuid でない id(前の system:<鍵> も)は 404
// - 管理者でなければ 403
// 実行: pnpm test src/domains/core/messaging/services/server/templates
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { MessageCategory, MessageChannel, MessageEnricher, MessageLayout } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { z } from "zod";

import type { MessageTemplate, MessageTemplateVersion } from "../../../entities/model";
import { TEST_LAYOUTS } from "../sendMessage/testHelpers";
import { createTemplateService } from "./templateService";
import type { MessageTemplateStore, TemplateKeptDispatch } from "./types";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const channel = (key: string, label: string, extra: Partial<MessageChannel> = {}): MessageChannel =>
  ({ key, label, addressing: "user", send: async () => [], ...extra }) as MessageChannel;
const channels: Record<string, MessageChannel> = {
  email: channel("email", "メール"),
  inApp: channel("inApp", "お知らせ"),
  line: channel("line", "LINE", { enabled: false }),
};
const categories: Record<string, MessageCategory> = {
  promotion: { key: "promotion", label: "お知らせ", kind: "promotion", channels: ["email", "inApp"] },
  operatorDirect: { key: "operatorDirect", label: "運営からのご連絡", kind: "direct", channels: ["email", "line"] },
  activity: { key: "activity", label: "反応", kind: "activity", channels: ["email", "inApp"] },
  account: { key: "account", label: "手続き", kind: "transactional", channels: ["email"] },
};
const enrichers: MessageEnricher[] = [
  {
    key: "displayName",
    target: { kinds: ["announcement", "direct", "promotion"] },
    provides: z.object({ displayName: z.string() }),
    aliases: { displayName: "表示名" },
    resolve: () => ({ displayName: "" }),
  },
];
/** notice = 管理者が選べるレイアウト(上流の汎用のお知らせ)、card = テストのカード(選べない) */
const layouts = { ...TEST_LAYOUTS, notice: { ...TEST_LAYOUTS.notice!, adminSelectable: true } };

const IMAGE = "storage://pub/notification.image/00000000-0000-4000-8000-000000000001.png";

function setup(
  options: {
    role?: string;
    kept?: TemplateKeptDispatch[];
    layouts?: Record<string, MessageLayout>;
    categories?: Record<string, MessageCategory>;
    previews?: { channel: string; category: string | undefined }[];
  } = {},
) {
  const templates: MessageTemplate[] = [];
  const versions: MessageTemplateVersion[] = [];
  const audits: AuditRecordInput[] = [];
  const kept = options.kept ?? [];
  const listQueries: (string | null)[] = [];
  const dispatchWrites: { id: string; values: Record<string, unknown>; metadata: Record<string, unknown> }[] = [];
  const dispatchAttached: { ref: string; dispatchId: string }[] = [];
  let clock = 0;
  const store: MessageTemplateStore<null> = {
    transaction: (run) => run(null),
    list: async ({ categories: only, q, limit, after }) => {
      listQueries.push(q);
      return templates
        .filter((row) => !only || only.includes(row.category))
        .filter((row) => !q || [row.name, ...stringsOf(row.values)].some((text) => text.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .filter((row) => !after || row.createdAt.getTime() < after.createdAt.getTime())
        .slice(0, limit + 1);
    },
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
        layout_version: 1,
        vars: [],
        createdAt: new Date(Date.UTC(2026, 10, 12, 0, 0, clock++)),
        updatedAt: null,
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
    remove: async (_tx, id) => {
      templates.splice(
        templates.findIndex((row) => row.id === id),
        1,
      );
      // 版は FK の cascade で消える
      for (let i = versions.length - 1; i >= 0; i -= 1) if (versions[i]!.template_id === id) versions.splice(i, 1);
    },
    lockKeptDispatches: async () => kept,
    updateDispatchImages: async (_tx, id, patch) => {
      dispatchWrites.push({ id, ...patch });
    },
    latestVersion: async (id) => versions.filter((row) => row.template_id === id).sort((a, b) => b.version - a.version)[0] ?? null,
    insertVersion: async (_tx, values) => {
      const row = { id: randomUUID(), edited_by: null, createdAt: new Date(), ...values } as MessageTemplateVersion;
      versions.push(row);
      return row;
    },
    listVersions: async (id) => versions.filter((row) => row.template_id === id).sort((a, b) => b.version - a.version),
    findVersion: async (id, version) => versions.find((row) => row.template_id === id && row.version === version) ?? null,
  };
  const service = createTemplateService({
    store,
    ledger: { find: async () => null, attach: async () => {}, copy: async (ref) => ref },
    // 送信の画像の台帳: テンプレートの画像(持ち主 = テンプレート)は送信へ複製する
    dispatchLedger: {
      find: async () => ({ status: "ready", purpose: "notification.image", ownerUserId: ADMIN, recordType: "messaging.template", recordId: "t" }),
      attach: async (_tx, input) => {
        dispatchAttached.push({ ref: input.ref, dispatchId: input.dispatchId });
      },
      copy: async (ref) => `${ref}#copy`,
    },
    check: () => ({ channels, categories: options.categories ?? categories, layouts: options.layouts ?? layouts, enrichers }),
    // プレビュー: email の notice はレイアウトの描き方を持つ扱い。送信チャンネルのプレビューが受けたカテゴリーを記録する
    layoutRenderers: () => ({ email: { notice: true } }),
    channelPreview: async (channelKey, previewInput) => {
      options.previews?.push({ channel: channelKey, category: previewInput.category });
      return { html: "<p>preview</p>" };
    },
    initialLayout: () => "notice",
    context: () => ({ actorId: ADMIN, actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    recordAudit: async (input) => audits.push(input),
  });
  return { service, templates, versions, audits, dispatchWrites, dispatchAttached, listQueries };
}

/** 欄の中身の文字列の値の全部(鍵は入れない。本物の store の jsonpath と同じ見方) */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsOf);
  return [];
}

const VALUES = { subject: "{{表示名}} 様へ {{discount}} 割引", blocks: [{ type: "paragraph", text: "{{serviceName}} より" }] };
const DISCOUNT = { key: "discount", alias: "割引率", type: "number", required: true };
const input = (extra: Record<string, unknown> = {}) => ({
  name: "春のセール",
  category: "promotion",
  layout: "notice",
  values: VALUES,
  vars: [DISCOUNT],
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

test("作る = 版 1 まで(保存 = 公開)、直す = 中身が違えば新しい版、版は不変で current_version が進み、監査に残る", async () => {
  const { service, versions, audits } = setup();
  const created = await service.createTemplate(input());
  assert.equal(created.currentVersion, 1);
  assert.equal(created.createdBy, ADMIN);
  assert.equal("status" in created, false);
  assert.equal(versions.length, 1);
  assert.deepEqual([versions[0]!.layout, versions[0]!.category, versions[0]!.values, versions[0]!.vars], ["notice", "promotion", VALUES, [DISCOUNT]]);
  assert.equal("channels" in versions[0]!, false);
  // 一覧(共通 + テンプレートに当たる enrichers + 専用)
  assert.ok(created.catalog.some((entry) => entry.key === "displayName" && entry.alias === "表示名" && entry.source === "enricher"));
  assert.ok(created.catalog.some((entry) => entry.key === "discount" && entry.alias === "割引率" && entry.source === "own"));

  const edited = await service.updateTemplate(created.id, { values: { subject: "新しい件名", blocks: [] } });
  assert.equal(edited.unchanged, false);
  assert.equal(edited.currentVersion, 2);
  // 行と新しい版は欄の zod を通した中身(空の任意の欄は落ちる)で同じ
  assert.deepEqual(edited.values, { subject: "新しい件名" });
  assert.deepEqual(versions.at(-1)!.values, edited.values);
  // 前の版は書き換わらない
  const v1 = await service.getTemplateVersion(created.id, 1);
  assert.deepEqual(v1.values, VALUES);
  assert.deepEqual((await service.listTemplateVersions(created.id)).map((v) => v.version), [2, 1]);
  assert.deepEqual(audits.map((a) => a.action), ["messaging.template.created", "messaging.template.updated"]);
  assert.deepEqual(audits[0]!.metadata, { key: created.key, version: 1 });
  assert.deepEqual(audits[1]!.metadata, { key: created.key, version: 2, newVersion: true });
});

test("直す: 中身が最新の版と同じなら版を作らず unchanged(409 にしない)。名前・説明だけの変更も保存して unchanged", async () => {
  const { service, versions, audits } = setup();
  const created = await service.createTemplate(input());
  const same = await service.updateTemplate(created.id, { values: VALUES });
  assert.equal(same.unchanged, true);
  assert.equal(same.currentVersion, 1);
  const renamed = await service.updateTemplate(created.id, { name: "夏のセール", description: "説明" });
  assert.equal(renamed.unchanged, true);
  assert.deepEqual([renamed.name, renamed.description, renamed.currentVersion], ["夏のセール", "説明", 1]);
  assert.equal(versions.length, 1);
  assert.deepEqual(audits.at(-1)!.metadata, { key: created.key, version: 1, newVersion: false });
  // カテゴリー・専用の宣言を替えるのは中身の変更 = 新しい版
  const recategorized = await service.updateTemplate(created.id, { category: "operatorDirect" });
  assert.deepEqual([recategorized.unchanged, recategorized.currentVersion, versions.at(-1)!.category], [false, 2, "operatorDirect"]);
});

test("レイアウトを替える時は新しいレイアウトの欄の中身も要る(D113、前の中身を持ち越さない)", async () => {
  const { service } = setup();
  const created = await service.createTemplate(input());
  await rejectsWith(service.updateTemplate(created.id, { layout: "card" }), 400, /欄の中身も/);
});

test("保存時の検査(400)、鍵はサーバーが作る(入力の key は 400)", async () => {
  const { service, templates } = setup();
  const cases: Record<string, unknown>[] = [
    // 鍵は受けない(サーバーが作る、D46)
    { key: "spring-sale" },
    // 前の形(送信チャンネルごとの content・variables)は黙って捨てない
    { content: { email: { subject: "s" } } },
    { variables: [] },
    { category: "nope" },
    // 3 つの種別でないカテゴリーはテンプレートに使えない
    { category: "activity" },
    { category: "account" },
    // 送信チャンネルの組は受けない(送信チャンネルは送る時のカテゴリーの送信チャンネル)
    { channels: ["email"] },
    // レイアウト: 無い・管理者が選べない
    { layout: "none" },
    { layout: "card", values: { title: "t" } },
    // 欄の中身: 件名は必須・知らない欄
    { values: { subject: "", blocks: [] } },
    { values: { subject: "s", nope: 1 } },
    // 文面の名前は一覧の中だけ
    { values: { subject: "{{unknown}}", blocks: [] } },
    // 専用の宣言: 形・共通の名前と重なる鍵 / 別名・専用どうしの重なり・秘密の型は無い
    { vars: [{ key: "discount" }] },
    { vars: [{ ...DISCOUNT, key: "bad-key" }] },
    { vars: [{ ...DISCOUNT, key: "serviceName" }] },
    { vars: [{ ...DISCOUNT, alias: "表示名" }] },
    { vars: [DISCOUNT, { ...DISCOUNT, key: "discount2" }] },
    { vars: [{ ...DISCOUNT, type: "secret" }] },
  ];
  for (const extra of cases) await rejectsWith(service.createTemplate(input(extra)), 400);
  assert.equal(templates.length, 0);
  const first = await service.createTemplate(input());
  const second = await service.createTemplate(input());
  assert.match(first.key, /^tpl-[a-z0-9]{10}$/);
  assert.notEqual(first.key, second.key, "同じ名前でも別の鍵");
  await rejectsWith(service.updateTemplate(first.id, { values: { subject: "{{nope}}", blocks: [] } }), 400);
  // 専用の値は別名でも鍵でも書ける
  const byKey = await service.createTemplate(input({ values: { subject: "{{displayName}} {{割引率}}", blocks: [] } }));
  assert.equal(byKey.currentVersion, 1);
});

test("消す(D137): 行と版が消え、欄の中身を残す送信の画像は送信に結び直す。監査 deleted、消した後は 404", async () => {
  const kept: TemplateKeptDispatch[] = [
    { id: "d1", actor_id: ADMIN, metadata: null, values: { subject: "s", blocks: [{ type: "image", src: IMAGE }] } },
    { id: "d2", actor_id: ADMIN, metadata: { inboxImages: { [IMAGE]: `${IMAGE}#bound` } }, values: { subject: "s", blocks: [{ type: "image", src: IMAGE }] } },
    { id: "d3", actor_id: ADMIN, metadata: null, values: { subject: "画像なし", blocks: [] } },
  ];
  const { service, templates, versions, audits, dispatchWrites, dispatchAttached } = setup({ kept });
  const created = await service.createTemplate(input());
  await service.updateTemplate(created.id, { values: { subject: "二版", blocks: [] } });
  const result = await service.deleteTemplate(created.id);
  assert.deepEqual(result, { id: created.id, deleted: true });
  assert.equal(templates.length, 0);
  assert.equal(versions.length, 0);
  // d1: テンプレートの画像を複製して送信へ attach し、中身の参照と metadata.inboxImages を書き換える
  assert.deepEqual(dispatchAttached, [{ ref: `${IMAGE}#copy`, dispatchId: "d1" }]);
  assert.deepEqual(dispatchWrites[0], {
    id: "d1",
    values: { subject: "s", blocks: [{ type: "image", src: `${IMAGE}#copy` }] },
    metadata: { inboxImages: { [IMAGE]: `${IMAGE}#copy` } },
  });
  // d2: 既に結んだ対応があれば使い回す(複製しない)、d3: 画像の無い送信は書かない
  assert.deepEqual(dispatchWrites[1], {
    id: "d2",
    values: { subject: "s", blocks: [{ type: "image", src: `${IMAGE}#bound` }] },
    metadata: { inboxImages: { [IMAGE]: `${IMAGE}#bound` } },
  });
  assert.equal(dispatchWrites.length, 2);
  assert.equal(audits.at(-1)!.action, "messaging.template.deleted");
  assert.deepEqual(audits.at(-1)!.metadata, { key: created.key, name: "春のセール", lastVersion: 2 });
  await rejectsWith(service.deleteTemplate(created.id), 404);
  await rejectsWith(service.getTemplate(created.id), 404);
});

test("一覧の文字検索 q: 名前か欄の中身の文字列(欄の名前は探さない)、前後の空白を落とす、空・101 字は 400", async () => {
  const { service, listQueries } = setup();
  await service.createTemplate(input({ name: "春のセール" }));
  await service.createTemplate(input({ name: "お知らせ", values: { subject: "夏の SALE のご案内", blocks: [{ type: "paragraph", text: "本文" }] } }));
  assert.deepEqual((await service.listTemplates({ q: "セール" })).items.map((t) => t.name), ["春のセール"]);
  assert.deepEqual((await service.listTemplates({ q: " sale " })).items.map((t) => t.name), ["お知らせ"]);
  assert.equal(listQueries.at(-1), "sale", "前後の空白を落として store へ");
  assert.deepEqual((await service.listTemplates({ q: "subject" })).items, [], "欄の名前では当たらない");
  assert.equal((await service.listTemplates()).items.length, 2);
  assert.equal(listQueries.at(-1), null);
  await rejectsWith(service.listTemplates({ q: "  " }), 400);
  await rejectsWith(service.listTemplates({ q: "あ".repeat(101) }), 400);
});

test("一覧(新しい順・cursor・種別で絞る D135)、無い id は 404、版の番号の誤りは 400", async () => {
  const { service } = setup();
  const a = await service.createTemplate(input({ name: "a" }));
  await service.createTemplate(input({ name: "b", category: "operatorDirect" }));
  const page = await service.listTemplates({ limit: "1" });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]!.name, "b");
  assert.equal(page.items[0]!.categoryLabel, "運営からのご連絡", "カテゴリーの表示名(受け口の label)");
  assert.ok(page.nextCursor);
  assert.deepEqual((await service.listTemplates({ cursor: page.nextCursor })).items.map((t) => t.name), ["a"]);
  assert.deepEqual((await service.listTemplates({ kind: "promotion" })).items.map((t) => t.name), ["a"]);
  assert.deepEqual((await service.listTemplates({ kind: "announcement" })).items, []);
  await rejectsWith(service.listTemplates({ kind: "nope" }), 400);
  // 読めない cursor は 400
  await rejectsWith(service.listTemplates({ cursor: "!!" }), 400);
  await rejectsWith(service.getTemplate(randomUUID()), 404);
  await rejectsWith(service.listTemplateVersions(randomUUID()), 404);
  await rejectsWith(service.getTemplateVersion(a.id, 0), 400);
  await rejectsWith(service.getTemplateVersion(a.id, 9), 404);
});

test("画面の選択肢: 使える送信チャンネル・3 つの種別のカテゴリー(使える送信チャンネルつき)・選べるレイアウト・基本の埋め込み情報", async () => {
  const { service } = setup();
  const options = await service.templateOptions();
  assert.deepEqual(options.channels, [
    { key: "email", label: "メール" },
    { key: "inApp", label: "お知らせ" },
  ]);
  assert.deepEqual(options.categories, [
    { key: "promotion", label: "お知らせ", description: null, kind: "promotion", channels: ["email", "inApp"] },
    { key: "operatorDirect", label: "運営からのご連絡", description: null, kind: "direct", channels: ["email"] },
  ]);
  assert.deepEqual(options.layouts.map((layout) => layout.key), ["notice"]);
  // 作る画面が最初に開くレイアウト = config の initialLayout
  assert.equal(options.initialLayout, "notice");
  const names = options.baseCatalog.map((entry) => entry.key);
  assert.ok(names.includes("serviceName"));
  assert.ok(names.includes("displayName"));
  assert.ok(!names.includes("discount"));
});

test("無効のレイアウト: 一覧は使えない印(usable: false)付きで並び、選択肢に出ず、そのレイアウトでは作れない", async () => {
  const current: Record<string, MessageLayout> = { ...layouts };
  const { service } = setup({ layouts: current });
  await service.createTemplate(input({ name: "a" }));
  assert.deepEqual((await service.listTemplates()).items.map((t) => [t.name, t.usable]), [["a", true]]);
  current.notice = { ...layouts.notice, disabled: true };
  assert.deepEqual((await service.listTemplates()).items.map((t) => [t.name, t.usable]), [["a", false]]);
  assert.deepEqual((await service.templateOptions()).layouts, []);
  await rejectsWith(service.createTemplate(input({ name: "b" })), 400);
});

test("レイアウトのプレビュー: 停止のリンクの見本(category)は好みに従う種別(promotion・activity)のカテゴリーの時だけ送信チャンネルへ渡す(送る時と同じ判定)", async () => {
  const previews: { channel: string; category: string | undefined }[] = [];
  const withAnnouncement: Record<string, MessageCategory> = {
    ...categories,
    news: { key: "news", label: "お知らせ(全員)", kind: "announcement", channels: ["email"] },
  };
  const { service } = setup({ categories: withAnnouncement, previews });
  for (const category of ["news", "operatorDirect", "promotion", "activity"]) {
    const preview = await service.previewLayout({ layout: "notice", channel: "email", category, values: VALUES });
    assert.equal(preview.cannotRender, null);
  }
  await service.previewLayout({ layout: "notice", channel: "email", values: VALUES });
  assert.deepEqual(
    previews.map((entry) => entry.category),
    [undefined, undefined, "promotion", "activity", undefined],
  );
  await rejectsWith(service.previewLayout({ layout: "notice", channel: "email", category: "nope", values: VALUES }), 400);
});

test("管理者でなければ 403", async () => {
  const { service } = setup({ role: "user" });
  await rejectsWith(service.templateOptions(), 403);
  await rejectsWith(service.listTemplates(), 403);
  await rejectsWith(service.createTemplate(input()), 403);
  await rejectsWith(service.deleteTemplate(randomUUID()), 403);
});

test("テンプレートは DB の物だけ: 一覧に system・kind は無く(作った時刻はいつもある)、uuid でない id(前の system:<鍵> も)は読む・直す・消す・版のどれも 404", async () => {
  const { service, audits } = setup();
  const saved = await service.createTemplate(input({ name: "a" }));
  const first = await service.listTemplates();
  assert.deepEqual(first.items.map((t) => [t.id, t.layout]), [[saved.id, "notice"]]);
  assert.equal("system" in first.items[0]!, false);
  assert.equal("kind" in first.items[0]!, false);
  assert.equal(typeof first.items[0]!.createdAt, "string");
  const auditCount = audits.length;
  for (const id of ["system:promotion", "not-a-uuid"]) {
    await rejectsWith(service.getTemplate(id), 404, /テンプレートがありません/);
    await rejectsWith(service.updateTemplate(id, { name: "x" }), 404, /テンプレートがありません/);
    await rejectsWith(service.deleteTemplate(id), 404, /テンプレートがありません/);
    await rejectsWith(service.listTemplateVersions(id), 404, /テンプレートがありません/);
    await rejectsWith(service.getTemplateVersion(id, 1), 404, /テンプレートがありません/);
  }
  assert.equal(audits.length, auditCount);
});
