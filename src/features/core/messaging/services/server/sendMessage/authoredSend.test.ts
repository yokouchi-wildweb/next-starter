// 管理者が書いた文面で送る(sendAuthored、D92)の検査(メモリの store・掃き出し・テンプレートの読み口は偽物)
// - その場で書いた文面: 回の鍵 = 送るカテゴリーの種別の authored の定義の鍵、回に書いた文面(authored_content)、template_edited false。
//   予約・cron は回の文面で組み直す。{{displayName}} は差し込み、知らない {{鍵}}・テンプレートなしの vars は 400
// - テンプレートを呼び出した文面: 今の公開版を回の template_id・template_version に固定(違えば 409)。版の変数の値が無い・型が合わない 400、
//   cron で回の値が版に合わない → 送らずに止める(template_vars_invalid)。取り下げ済み・未公開 409、受信者ごとの変数に既定値が無ければ 400。
//   版から直したかを template_edited に残し、cron は回の文面で送る(後で版を直しても)
// - 経路 = 種類の経路 ∩ 絞り。その中に文面の無い経路があれば 400。種別が announcement・direct・marketing でないカテゴリーは 400
// - 画像: 文面に自由に入れられる(版に無い画像も)。テンプレートの画像(台帳の持ち主 = テンプレート)は回が複製を持つ
// - この列より前のその場で書いた回(文面の無い authored の回)は組めない(authored_missing)
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/authoredSend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { MessageEnricher } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { definitionOfDispatch } from "./dispatchDefinition";

import { bindInboxImages } from "../inbox/imageBinding";
import { sweepMessages } from "../sweep/sweep";
import { createMemoryWorld, createSweepDeps } from "../sweep/testHelpers";
import { TEMPLATE_IMAGE_RECORD_TYPE } from "../templates/imageBinding";
import { createMessageSender } from "./sender";
import { createTestChannel } from "./testHelpers";
import type { MessageTemplateVersionSource } from "./types";

const T0 = new Date("2026-11-10T00:00:00.000Z");
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const deadline = () => ({ deadline: new Date(Date.now() + 60_000) });

const enrichers: Record<string, MessageEnricher> = {
  displayName: {
    key: "displayName",
    messages: ["messaging.adminAnnouncement", "messaging.adminDirect", "messaging.adminMarketing"],
    provides: z.object({ displayName: z.string() }),
    resolve: ({ recipient }) => ({ displayName: recipient.name ?? "お客様" }),
  },
};

function version(n: number, title: string, variables: MessageTemplateVersionSource["variables"] = [
  { key: "discount", label: "割引", type: "number", required: true, source: "dispatch" },
]): MessageTemplateVersionSource {
  return {
    templateId: "tpl-1",
    templateKey: "spring",
    version: n,
    category: "news",
    content: { test: { title, body: "{{displayName}}" } },
    variables,
  };
}

function setup() {
  const world = createMemoryWorld();
  for (const id of ["u1", "u2"]) {
    world.store.users.push({ id, name: `名前${id}`, email: `${id}@example.test` });
    world.store.endpoints.push({ userId: id, channel: "test", address: `addr-${id}` });
  }
  const versions: MessageTemplateVersionSource[] = [version(1, "v1 {{discount}}% 引き")];
  const state = { status: "published" as string, current: 1 as number | null };
  const channel = createTestChannel("test");
  const deps = createSweepDeps(world, {
    channels: { test: channel },
    enrichers,
    templates: {
      loadCurrent: async (id) =>
        id === "tpl-1"
          ? { status: state.status, version: versions.find((v) => v.version === state.current) ?? null }
          : null,
      loadVersion: async (id, n) => (id === "tpl-1" ? (versions.find((v) => v.version === n) ?? null) : null),
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

const TPL = { templateId: "tpl-1", version: 1 };

test("その場で書いた文面: 鍵は種別の定義、回に文面、予約の後も cron は回の文面で送る(宛名は差し込む)", async () => {
  const { world, deps, channel, sender } = setup();
  const content = { test: { title: "{{displayName}} 様へ", body: "本文" } };
  const result = await sender.sendAuthored({ content, category: "news", recipients: [{ userId: "u1" }], scheduledAt: later(60) });
  assert.equal(result.status, "scheduled");
  assert.equal(result.template, undefined);
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.message_key, "messaging.adminMarketing");
  assert.equal(dispatch.template_id, null);
  assert.equal(dispatch.template_edited, false);
  assert.deepEqual(dispatch.authored_content, content);
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.deepEqual(channel.calls.flat()[0].content, { title: "名前u1 様へ", body: "本文" });
});

test("その場で書いた文面の検査: 知らない {{鍵}}・テンプレートなしの vars・文面の無い経路・3 つの種別でないカテゴリーは 400", async () => {
  const { sender } = setup();
  const base = { category: "news", recipients: [{ userId: "u1" }] };
  await rejectsWith(sender.sendAuthored({ ...base, content: { test: { title: "{{nope}}", body: "" } } }), 400, /nope/);
  await rejectsWith(sender.sendAuthored({ ...base, content: { test: { title: "t", body: "" } }, vars: { a: 1 } }), 400, /テンプレート/);
  await rejectsWith(sender.sendAuthored({ ...base, content: {} }), 400, /test の文面がありません/);
  await rejectsWith(sender.sendAuthored({ ...base, category: "account", content: { test: { title: "t", body: "" } } }), 400, /announcement・direct・marketing/);
  // 欄は経路の受け口の zod で検査する(test の経路は title が必須)
  await rejectsWith(sender.sendAuthored({ ...base, content: { test: { body: "題が無い" } } }), 400, /test の欄が正しくない/);
});

test("テンプレート: 版を回に固定し、予約の後で版を直しても cron は回の文面で送る", async () => {
  const { world, deps, channel, versions, state, sender } = setup();
  const result = await sender.sendAuthored({
    template: TPL,
    content: versions[0].content,
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
  assert.deepEqual(dispatch.authored_content, versions[0].content);
  assert.equal(dispatch.message_key, "messaging.adminMarketing");
  assert.equal(dispatch.kind, "marketing");
  assert.deepEqual(dispatch.vars, { discount: "20" });

  versions.push(version(2, "v2 {{discount}}"));
  state.current = 2;
  deps.setNow(later(600));
  await sweepMessages(deps, deadline());
  assert.equal(dispatch.status, "completed");
  const sent = channel.calls.flat();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].content, { title: "v1 20% 引き", body: "名前u1" });
});

test("テンプレート: 今送る小さな送信、種別 direct のカテゴリー", async () => {
  const { world, channel, versions, sender } = setup();
  const result = await sender.sendAuthored({ template: TPL, content: versions[0].content, recipients: [{ userId: "u2" }], vars: { discount: "5" }, category: "directTest" });
  assert.equal(result.status, "completed");
  assert.equal(world.store.dispatches[0].kind, "direct");
  assert.equal(world.store.dispatches[0].message_key, "messaging.adminDirect");
  assert.deepEqual(channel.calls.flat()[0].content, { title: "v1 5% 引き", body: "名前u2" });
});

test("テンプレートの検査: 値が無い・型が違う 400、取り下げ・未公開 409、無い 404、受信者ごとの変数の既定値", async () => {
  const { world, versions, state, sender } = setup();
  const base = { template: TPL, content: versions[0].content, category: "news", recipients: [{ userId: "u1" }] };
  await rejectsWith(sender.sendAuthored({ ...base, vars: {} }), 400, /discount/);
  await rejectsWith(sender.sendAuthored({ ...base, vars: { discount: "たくさん" } }), 400, /discount/);
  await rejectsWith(sender.sendAuthored({ ...base, template: { templateId: "none", version: 1 }, vars: { discount: 1 } }), 404);
  state.status = "archived";
  await rejectsWith(sender.sendAuthored({ ...base, vars: { discount: 1 } }), 409);
  state.status = "draft";
  state.current = null;
  await rejectsWith(sender.sendAuthored({ ...base, vars: { discount: 1 } }), 409);

  state.status = "published";
  versions.push(
    version(3, "{{discount}} {{code}}", [
      { key: "discount", label: "割引", type: "number", required: true, source: "dispatch" },
      { key: "code", label: "コード", type: "string", required: true, source: "recipient" },
    ]),
  );
  state.current = 3;
  const v3 = { ...base, template: { templateId: "tpl-1", version: 3 }, content: versions.at(-1)!.content };
  await rejectsWith(sender.sendAuthored({ ...v3, vars: { discount: 1 } }), 400, /code/);
  versions.at(-1)!.variables[1].default = "WELCOME";
  const ok = await sender.sendAuthored({ ...v3, vars: { discount: 1 } });
  assert.equal(ok.status, "completed");
  assert.equal(world.store.dispatches.at(-1)?.template_version, 3);
});

test("cron の再検査: 回の値が版に合わなければ送らずに止める", async () => {
  const { world, deps, channel, versions, sender } = setup();
  await sender.sendAuthored({ template: TPL, content: versions[0].content, category: "news", recipients: [{ userId: "u1" }], vars: { discount: 10 }, scheduledAt: later(60) });
  world.store.dispatches[0].vars = {};
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.equal(channel.calls.length, 0);
  const rows = world.store.deliveries;
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.status === "failed" && row.last_error === "template_vars_invalid"));
});

test("画像: テンプレートの画像(台帳の持ち主 = テンプレート)は回が複製を持つ", async () => {
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

test("画像: 管理者が自分で上げた未紐付けの画像は回へ attach(複製しない)", async () => {
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

test("テンプレートを直して送る: 回に template_edited と文面、版に無い画像も送れる", async () => {
  const { world, deps, channel, versions, state, sender } = setup();
  // 版に無い画像の参照(storage://)も入れられる(送る口がお知らせの行を書く時に回へ結ぶ)
  const edited = { test: { title: "直した {{discount}}", body: "storage://pub/notification.image/added.png" } };
  await sender.sendAuthored({ template: TPL, content: edited, category: "news", recipients: [{ userId: "u1" }], vars: { discount: 3 }, scheduledAt: later(60) });
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.template_version, 1);
  assert.equal(dispatch.template_edited, true);
  assert.deepEqual(dispatch.authored_content, edited);
  versions.push(version(2, "v2"));
  state.current = 2;
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.equal(channel.calls.flat()[0].content.title, "直した 3");
});

test("版は今の公開版だけ(違えば 409)。文面の無い経路・絞りの外は 400", async () => {
  const { sender, versions, state } = setup();
  versions.push(version(2, "v2"));
  state.current = 2;
  const base = { template: { templateId: "tpl-1", version: 2 }, content: versions[1].content, recipients: [{ userId: "u1" }], vars: { discount: 1 } };
  await rejectsWith(sender.sendAuthored({ ...base, template: TPL, category: "news" }), 409, /今の公開版/);
  // 種類 newsInApp の経路は test・inApp: inApp の文面が無いまま全部の経路で送ると 400、test だけに絞れば送れる
  await rejectsWith(sender.sendAuthored({ ...base, category: "newsInApp" }), 400, /inApp の文面がありません/);
  await rejectsWith(sender.sendAuthored({ ...base, category: "news", channels: ["inApp"] }), 400, /中の絞り/);
  const ok = await sender.sendAuthored({ ...base, category: "newsInApp", channels: ["test"] });
  assert.equal(ok.status, "completed");
});

test("プレビューも同じ組み方(テンプレートは版の変数、その場で書いた文面は宛名だけ)", async () => {
  const { sender } = setup();
  const preview = await sender.previewMessage(
    { authored: { content: { test: { title: "見本 {{discount}}" } }, category: "news", template: TPL } },
    { vars: { discount: 7 }, userId: "u1" },
  );
  assert.deepEqual(preview.channels[0].fields, { title: "見本 7" });
  assert.deepEqual(preview.template, { id: "tpl-1", version: 1 });
  const adhoc = await sender.previewMessage({ authored: { content: { test: { title: "{{displayName}}" } }, category: "news" } }, { vars: {}, userId: "u1" });
  assert.deepEqual(adhoc.channels[0].fields, { title: "名前u1" });
  assert.equal(adhoc.template, null);
});

test("この列より前のその場で書いた回(文面の無い authored の回)は組めない", async () => {
  const { deps } = setup();
  const { message } = await import("../../../messages/adminMarketing");
  const registry = { "messaging.adminMarketing": { key: "messaging.adminMarketing", definition: async () => ({ message }) } };
  const loaded = await definitionOfDispatch({ ...deps, registry } as typeof deps, {
    message_key: "messaging.adminMarketing",
    template_id: null,
    template_version: null,
    authored_content: null,
    category: "news",
    vars: { subject: "前の形" },
    channels: ["test"],
  });
  assert.deepEqual(loaded, { error: "authored_missing" });
});
