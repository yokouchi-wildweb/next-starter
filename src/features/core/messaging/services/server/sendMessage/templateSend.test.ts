// テンプレート + 欄の中身で送る(sendTemplateMessage、D117・D125・D128)の検査(メモリの store・掃き出し・テンプレートの読み口は偽物)
// - 白紙のシステムテンプレート: 送信の message_key は null・system_template = 白紙の鍵・template_id null・直した印 false、レイアウトと欄の中身(values)。
//   予約・cron は送信の欄の中身で組み直す。{{displayName}} は差し込み、知らない {{鍵}}・白紙での vars・知らない白紙・種別の違うカテゴリーは 400
// - DB のテンプレート: 今の版を送信の template_id・template_version に固定(違えば 409)。専用の埋め込み情報の値(vars)が無い・型が合わない 400、
//   必須で値が無ければ既定値、既定値も無ければ 400。無いテンプレート 404・版の無いテンプレート 409(下書き・取り下げは無い D134・D137)。
//   値は送信の embedded_values に残り、vars は {}。直した印 = 入力の edited か版の中身との違い
// - 送信チャンネル = カテゴリーの送信チャンネル ∩ 絞り(外は 400)。種別が自由連絡で送れる物でないカテゴリーは 400
// - 画像: 中身に自由に入れられる(版に無い画像も)。テンプレートの画像(台帳の持ち主 = テンプレート)は送信が複製を持つ
// - 欄の中身の無い送信は cron が送らずに止める(values_missing)
// - 受け口の検査 checkSystemTemplates(上流の白紙 6 つは通る、種別ごとに何本でも D119)。受け口が空の送る口は白紙から送れない(500)
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/templateSend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { MessageVarDeclaration, MessageEnricher, MessageSystemTemplate } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { bindInboxImages } from "../inbox/imageBinding";
import { sweepMessages } from "../sweep/sweep";
import { createMemoryWorld, createSweepDeps } from "../sweep/testHelpers";
import { TEMPLATE_IMAGE_RECORD_TYPE } from "../templates/imageBinding";
import { layouts as upstreamLayouts } from "../../../extensions/layouts";
import { systemTemplates as upstreamSystemTemplates } from "../../../extensions/systemTemplates";
import { createMessageSender } from "./sender";
import { checkSystemTemplates } from "./systemTemplates";
import { createTestChannel } from "./testHelpers";
import type { MessageTemplateVersionSource } from "./types";

const T0 = new Date("2026-11-10T00:00:00.000Z");
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const deadline = () => ({ deadline: new Date(Date.now() + 60_000) });

const enrichers: Record<string, MessageEnricher> = {
  displayName: {
    key: "displayName",
    target: { kinds: ["announcement", "direct", "promotion"] },
    provides: z.object({ displayName: z.string() }),
    aliases: { displayName: "表示名" },
    resolve: ({ recipient }) => ({ displayName: recipient.name ?? "お客様" }),
  },
};

const SYSTEM_TEMPLATES: Record<string, MessageSystemTemplate> = {
  announcement: { key: "announcement", kind: "announcement", label: "お知らせの白紙", layout: "notice", values: { subject: "", blocks: [] } },
  promotion: { key: "promotion", kind: "promotion", label: "宣伝の白紙", layout: "notice", values: { subject: "", blocks: [] } },
  direct: { key: "direct", kind: "direct", label: "個別の白紙", layout: "notice", values: { subject: "", blocks: [] } },
};

const DISCOUNT: MessageVarDeclaration = { key: "discount", alias: "割引率", type: "number", required: true };

/** 版の中身 = notice の件名 + 宛名の段落、専用の埋め込み情報の宣言 */
function version(n: number, title: string, vars: MessageVarDeclaration[] = [DISCOUNT]): MessageTemplateVersionSource {
  return {
    templateId: "tpl-1",
    templateKey: "spring",
    version: n,
    category: "news",
    layout: "notice",
    layoutVersion: 1,
    values: { subject: title, blocks: [{ type: "paragraph", text: "{{displayName}}" }] },
    vars,
  };
}

function setup() {
  const world = createMemoryWorld();
  for (const id of ["u1", "u2"]) {
    world.store.users.push({ id, name: `名前${id}`, email: `${id}@example.test` });
    world.store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  }
  const versions: MessageTemplateVersionSource[] = [version(1, "v1 {{discount}}% 引き")];
  // exists = テンプレートの行がある(消すと false)、current = 今の版(null = 版が無い)
  const state = { exists: true, current: 1 as number | null };
  const channel = createTestChannel("test");
  const deps = createSweepDeps(world, {
    channels: { test: channel },
    enrichers,
    systemTemplates: SYSTEM_TEMPLATES,
    templates: {
      loadCurrent: async (id) =>
        id === "tpl-1" && state.exists ? { version: versions.find((v) => v.version === state.current) ?? null } : null,
      loadVersion: async (id, n) => (id === "tpl-1" && state.exists ? (versions.find((v) => v.version === n) ?? null) : null),
    },
  });
  return { world, deps, channel, versions, state, sender: createMessageSender(deps) };
}

async function rejectsWith(run: Promise<unknown>, status: number, message?: RegExp) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    if (message) assert.match(error.message, message);
    return true;
  });
}

const TPL = { id: "tpl-1", version: 1 };
const BLANK = { system: "promotion" };
/** 版 1 の中身を notice に読み替えた物(直していない送り) */
const V1_VALUES = { subject: "v1 {{discount}}% 引き", blocks: [{ type: "paragraph", text: "{{displayName}}" }] };
const values = (subject: string, ...paragraphs: string[]) => ({ subject, blocks: paragraphs.map((text) => ({ type: "paragraph", text })) });

test("白紙: 送信は message_key null・system_template、レイアウトと欄の中身、予約の後も cron は送信の中身で送る(宛名は差し込む)", async () => {
  const { world, deps, channel, sender } = setup();
  const result = await sender.sendTemplateMessage({
    template: BLANK,
    values: values("{{displayName}} 様へ", "本文"),
    category: "news",
    recipients: [{ userId: "u1" }],
    scheduledAt: later(60),
  });
  assert.equal(result.status, "scheduled");
  assert.equal(result.template, undefined);
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.message_key, null);
  assert.equal(dispatch.system_template, "promotion");
  assert.equal(dispatch.template_id, null);
  assert.equal(dispatch.template_edited, false);
  assert.equal(dispatch.layout, "notice");
  assert.equal(dispatch.layout_version, 1);
  assert.deepEqual(dispatch.values, values("{{displayName}} 様へ", "本文"));
  assert.equal(dispatch.category, "news");
  assert.equal(dispatch.kind, "promotion");
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.equal(dispatch.status, "completed");
  assert.deepEqual(channel.calls.flat()[0].content, { title: "名前u1 様へ", body: "本文" });
});

test("白紙の検査: 知らない {{鍵}}・宣言の無い白紙への専用の値・直した印は無視・知らない白紙・種別の違うカテゴリー・送れない種別・欄の中身は 400", async () => {
  const { sender } = setup();
  const base = { template: BLANK, category: "news", recipients: [{ userId: "u1" }] };
  await rejectsWith(sender.sendTemplateMessage({ ...base, values: values("{{nope}}") }), 400, /nope/);
  // 宣言の無い白紙に専用の値を渡すと 400(知らない鍵)
  await rejectsWith(sender.sendTemplateMessage({ ...base, values: values("t"), vars: { a: 1 } }), 400);
  await rejectsWith(sender.sendTemplateMessage({ ...base, template: { system: "none" }, values: values("t") }), 400, /none/);
  await rejectsWith(sender.sendTemplateMessage({ ...base, template: { system: "announcement" }, values: values("t") }), 400, /同じ種別/);
  await rejectsWith(sender.sendTemplateMessage({ ...base, category: "account", values: values("t") }), 400, /announcement・direct・promotion/);
  // 欄の中身はレイアウトの欄の zod で検査する(notice の件名は必須)
  await rejectsWith(sender.sendTemplateMessage({ ...base, values: { blocks: [] } }), 400, /欄の中身/);
  // 白紙の送りは直した印を持たない(入力に edited があっても false)
  const ok = await sender.sendTemplateMessage({ ...base, values: values("t"), edited: true });
  assert.equal(ok.status, "completed");
});

test("白紙の受け口が無い送る口は白紙から送れない(受け口の誤り = 500: 送れる種別ごとに 1 本は要る D119)", async () => {
  const world = createMemoryWorld();
  const deps = createSweepDeps(world, { channels: { test: createTestChannel("test") }, enrichers });
  await rejectsWith(
    createMessageSender(deps).sendTemplateMessage({ template: BLANK, values: values("t"), category: "news", recipients: [{ userId: "u1" }] }),
    500,
    /種別 promotion の使うシステムテンプレートが 1 本も無い/,
  );
});

test("DB のテンプレート: 版を送信に固定し(message_key null)、予約の後で版を直しても cron は送信の欄の中身で送る", async () => {
  const { world, deps, channel, versions, state, sender } = setup();
  const result = await sender.sendTemplateMessage({
    template: TPL,
    values: V1_VALUES,
    category: "news",
    recipients: [{ userId: "u1" }],
    vars: { discount: 20 },
    scheduledAt: later(600),
  });
  assert.equal(result.status, "scheduled");
  assert.deepEqual(result.template, { id: "tpl-1", version: 1, edited: false });
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.template_id, "tpl-1");
  assert.equal(dispatch.template_version, 1);
  assert.equal(dispatch.template_edited, false);
  assert.equal(dispatch.system_template, null);
  assert.equal(dispatch.message_key, null);
  assert.equal(dispatch.layout, "notice");
  assert.deepEqual(dispatch.values, V1_VALUES);
  assert.equal(dispatch.kind, "promotion");
  // 専用の値は embedded_values にだけ残る(vars は {}、指令 58)
  assert.deepEqual(dispatch.vars, {});
  assert.deepEqual(dispatch.embedded_values, { discount: "20" });

  versions.push(version(2, "v2 {{discount}}"));
  state.current = 2;
  deps.setNow(later(600));
  await sweepMessages(deps, deadline());
  assert.equal(dispatch.status, "completed");
  const sent = channel.calls.flat();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].content, { title: "v1 20% 引き", body: "名前u1" });
});

test("DB のテンプレート: 今送る小さな送信、種別 direct のカテゴリー", async () => {
  const { world, channel, sender } = setup();
  const result = await sender.sendTemplateMessage({ template: TPL, values: V1_VALUES, recipients: [{ userId: "u2" }], vars: { discount: "5" }, category: "directTest" });
  assert.equal(result.status, "completed");
  assert.equal(world.store.dispatches[0].kind, "direct");
  assert.equal(world.store.dispatches[0].message_key, null);
  assert.deepEqual(channel.calls.flat()[0].content, { title: "v1 5% 引き", body: "名前u2" });
});

test("DB のテンプレートの検査: 値が無い・型が違う 400、無い 404・消した 404・版が無い 409、必須の値の既定値", async () => {
  const { world, versions, state, sender } = setup();
  const base = { template: TPL, values: V1_VALUES, category: "news", recipients: [{ userId: "u1" }] };
  await rejectsWith(sender.sendTemplateMessage({ ...base, vars: {} }), 400, /discount/);
  await rejectsWith(sender.sendTemplateMessage({ ...base, vars: { discount: "たくさん" } }), 400, /discount/);
  await rejectsWith(sender.sendTemplateMessage({ ...base, template: { id: "none", version: 1 }, vars: { discount: 1 } }), 404);
  // 消したテンプレート(D137)は無いのと同じ 404
  state.exists = false;
  await rejectsWith(sender.sendTemplateMessage({ ...base, vars: { discount: 1 } }), 404);
  state.exists = true;
  // 版の無いテンプレートは送れない(保存 = 公開なので普通は無い、D134)
  state.current = null;
  await rejectsWith(sender.sendTemplateMessage({ ...base, vars: { discount: 1 } }), 409);

  versions.push(version(3, "{{discount}} {{code}}", [DISCOUNT, { key: "code", alias: "コード", type: "line", required: true }]));
  state.current = 3;
  const v3 = { ...base, template: { id: "tpl-1", version: 3 }, values: values("{{discount}} {{code}}", "{{displayName}}") };
  await rejectsWith(sender.sendTemplateMessage({ ...v3, vars: { discount: 1 } }), 400, /code/);
  versions.at(-1)!.vars[1] = { ...versions.at(-1)!.vars[1]!, default: "WELCOME" };
  const ok = await sender.sendTemplateMessage({ ...v3, vars: { discount: 1 } });
  assert.equal(ok.status, "completed");
  assert.equal(world.store.dispatches.at(-1)?.template_version, 3);
  assert.equal(world.store.dispatches.at(-1)?.template_edited, false);
  assert.deepEqual(world.store.dispatches.at(-1)?.embedded_values, { discount: "1", code: "WELCOME" });
});

test("cron は版を引き直さず送信の物だけで描く: テンプレートが消えても送り、欄の中身の無い送信は止める(values_missing)", async () => {
  const { world, deps, channel, versions, sender } = setup();
  await sender.sendTemplateMessage({ template: TPL, values: V1_VALUES, category: "news", recipients: [{ userId: "u1" }], vars: { discount: 10 }, scheduledAt: later(60) });
  await sender.sendTemplateMessage({ template: TPL, values: V1_VALUES, category: "news", recipients: [{ userId: "u2" }], vars: { discount: 10 }, scheduledAt: later(60) });
  versions.splice(0, versions.length);
  world.store.dispatches[1].values = null;
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.deepEqual(channel.calls.flat().map((target) => target.content.title), ["v1 10% 引き"]);
  const stopped = world.store.deliveries.filter((row) => row.dispatch_id === world.store.dispatches[1].id);
  assert.ok(stopped.length > 0 && stopped.every((row) => row.status === "failed" && row.last_error === "values_missing"));
});

test("画像: テンプレートの画像(台帳の持ち主 = テンプレート)は送信が複製を持つ", async () => {
  const copied: string[] = [];
  const attached: string[] = [];
  const ledger = {
    find: async () => ({ status: "ready", purpose: "notification.image", ownerUserId: "admin", recordType: TEMPLATE_IMAGE_RECORD_TYPE, recordId: "tpl-1" }),
    attach: async (_tx: null, input: { ref: string }) => {
      attached.push(input.ref);
    },
    copy: async (ref: string) => {
      copied.push(ref);
      return `${ref}#copy`;
    },
  };
  const ref = "storage://pub/notification.image/00000000-0000-4000-8000-000000000001.png";
  const { map } = await bindInboxImages(ledger, null, { id: "d1", actor_id: "admin", metadata: null }, [ref]);
  assert.deepEqual(copied, [ref]);
  assert.deepEqual(attached, [`${ref}#copy`]);
  assert.equal(map.get(ref), `${ref}#copy`);
});

test("画像: 管理者が自分で上げた未紐付けの画像は送信へ attach(複製しない)", async () => {
  const copied: string[] = [];
  const attached: string[] = [];
  const ledger = {
    find: async () => ({ status: "ready", purpose: "notification.image", ownerUserId: "admin", recordType: null, recordId: null }),
    attach: async (_tx: null, input: { ref: string }) => {
      attached.push(input.ref);
    },
    copy: async (ref: string) => {
      copied.push(ref);
      return `${ref}#copy`;
    },
  };
  const ref = "storage://pub/notification.image/00000000-0000-4000-8000-000000000002.png";
  await bindInboxImages(ledger, null, { id: "d1", actor_id: "admin", metadata: null }, [ref]);
  assert.deepEqual(copied, []);
  assert.deepEqual(attached, [ref]);
});

test("直した印: 版の中身と違えば true(版に無い画像も送れる)、同じでも入力の edited: true なら true", async () => {
  const { world, deps, channel, versions, state, sender } = setup();
  const edited = values("直した {{discount}}", "storage://pub/notification.image/added.png");
  await sender.sendTemplateMessage({ template: TPL, values: edited, category: "news", recipients: [{ userId: "u1" }], vars: { discount: 3 }, scheduledAt: later(60) });
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.template_version, 1);
  assert.equal(dispatch.template_edited, true);
  assert.deepEqual(dispatch.values, edited);
  const marked = await sender.sendTemplateMessage({ template: TPL, values: V1_VALUES, edited: true, category: "news", recipients: [{ userId: "u2" }], vars: { discount: 3 } });
  assert.deepEqual(marked.template, { id: "tpl-1", version: 1, edited: true });
  versions.push(version(2, "v2"));
  state.current = 2;
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.ok(channel.calls.flat().some((target) => target.content.title === "直した 3"));
});

test("版は今の版だけ(違えば 409)。絞りの外は 400", async () => {
  const { sender, versions, state } = setup();
  versions.push(version(2, "v2"));
  state.current = 2;
  const base = { template: { id: "tpl-1", version: 2 }, values: values("v2", "{{displayName}}"), recipients: [{ userId: "u1" }], vars: { discount: 1 } };
  await rejectsWith(sender.sendTemplateMessage({ ...base, template: TPL, category: "news" }), 409, /今の公開版/);
  await rejectsWith(sender.sendTemplateMessage({ ...base, category: "news", channels: ["inApp"] }), 400, /中の絞り/);
  const ok = await sender.sendTemplateMessage({ ...base, category: "newsInApp", channels: ["test"] });
  assert.equal(ok.status, "completed");
});

test("プレビューも同じ組み方(DB のテンプレートは版の専用の宣言、白紙は宛名だけ)", async () => {
  const { sender } = setup();
  const preview = await sender.previewMessage(
    { template: { template: TPL, values: values("見本 {{discount}}"), category: "news" } },
    { vars: { discount: 7 }, userId: "u1" },
  );
  assert.equal((preview.channels[0].fields as { title?: unknown }).title, "見本 7");
  assert.deepEqual(preview.template, { id: "tpl-1", version: 1 });
  const blank = await sender.previewMessage({ template: { template: BLANK, values: values("{{displayName}}"), category: "news" } }, { vars: {}, userId: "u1" });
  assert.equal((blank.channels[0].fields as { title?: unknown }).title, "名前u1");
  assert.equal(blank.template, null);
});

test("受け口の検査: 上流の白紙 6 つは通る(種別ごとに何本でも、D119)。送れない種別・無いレイアウト・正しくない専用の宣言・種別の白紙が無いのは止める", () => {
  assert.deepEqual(checkSystemTemplates(upstreamSystemTemplates, upstreamLayouts), []);
  assert.deepEqual(Object.values(upstreamSystemTemplates).map((t) => t.kind).sort(), [
    "announcement",
    "announcement",
    "direct",
    "direct",
    "promotion",
    "promotion",
  ]);
  const problems = checkSystemTemplates(
    {
      a: { key: "a", kind: "security", label: "警告", layout: "notice", values: {} },
      b: { key: "b", kind: "promotion", label: "宣伝 1", layout: "notice", values: {} },
      c: { key: "c", kind: "promotion", label: "宣伝 2", layout: "none", values: {} },
      d: { key: "d", kind: "promotion", label: "宣伝 3", layout: "notice", values: {}, vars: [{ key: "startAt", alias: "", type: "datetime", required: true }] },
    },
    upstreamLayouts,
  );
  const text = problems.join(" / ");
  assert.match(text, /security/);
  assert.match(text, /none/);
  assert.match(text, /startAt/);
  // 送れる種別ごとに 1 本は要る(announcement・direct が無い)
  assert.match(text, /種別 announcement の使うシステムテンプレートが 1 本も無い/);
  assert.match(text, /種別 direct の使うシステムテンプレートが 1 本も無い/);
  assert.equal(problems.length, 5, text);
});
