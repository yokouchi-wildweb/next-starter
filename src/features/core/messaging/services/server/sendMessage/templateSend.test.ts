// テンプレートで送る(sendTemplate)の検査(メモリの store・掃き出し・テンプレートの読み口は偽物)
// - 送る時(予約なら予約の時)の公開版を回の template_id・template_version に固定し、後で直しても cron はその版で送る
// - 変数の値が無い・型が合わない → 400(送る口)/ cron で回の値が版に合わない → 送らずに止める(template_vars_invalid)
// - 取り下げ済み・未公開は 409、受信者ごとの変数に既定値が無ければ 400
// - テンプレートの画像(台帳の持ち主 = テンプレート)は回が複製を持つ(お知らせの画像の結び方)
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/templateSend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { MessageEnricher } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

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
    messages: ["messaging.adminMessage"],
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
    channels: ["test"],
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

test("版を回に固定し、予約の後で直しても cron はその版で送る", async () => {
  const { world, deps, channel, versions, state, sender } = setup();
  const result = await sender.sendTemplate({
    templateId: "tpl-1",
    recipients: [{ userId: "u1" }],
    vars: { discount: 20 },
    scheduledAt: later(600),
  });
  assert.equal(result.status, "scheduled");
  const dispatch = world.store.dispatches[0];
  assert.equal(dispatch.template_id, "tpl-1");
  assert.equal(dispatch.template_version, 1);
  assert.equal(dispatch.message_key, "messaging.adminMessage");
  assert.equal(dispatch.kind, "marketing");
  assert.equal(dispatch.category, "news");
  assert.deepEqual(dispatch.vars, { discount: "20" });

  // テンプレートを直して版 2 を公開
  versions.push(version(2, "v2 {{discount}}"));
  state.current = 2;
  deps.setNow(later(600));
  await sweepMessages(deps, deadline());
  assert.equal(dispatch.status, "completed");
  const sent = channel.calls.flat();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].content, { title: "v1 20% 引き", body: "名前u1" });
});

test("今送る: 小さな送信は要求の中で版の中身を送る", async () => {
  const { world, channel, sender } = setup();
  const result = await sender.sendTemplate({ templateId: "tpl-1", recipients: [{ userId: "u2" }], vars: { discount: "5" }, category: "account" });
  assert.equal(result.status, "completed");
  assert.equal(world.store.dispatches[0].kind, "transactional");
  assert.deepEqual(channel.calls.flat()[0].content, { title: "v1 5% 引き", body: "名前u2" });
});

test("送る時の検査: 値が無い・型が違う 400、取り下げ・未公開 409、無い 404、受信者ごとの変数の既定値", async () => {
  const { world, versions, state, sender } = setup();
  const base = { templateId: "tpl-1", recipients: [{ userId: "u1" }] };
  await rejectsWith(sender.sendTemplate({ ...base, vars: {} }), 400, /discount/);
  await rejectsWith(sender.sendTemplate({ ...base, vars: { discount: "たくさん" } }), 400, /discount/);
  await rejectsWith(sender.sendTemplate({ ...base, templateId: "none", vars: { discount: 1 } }), 404);
  state.status = "archived";
  await rejectsWith(sender.sendTemplate({ ...base, vars: { discount: 1 } }), 409);
  state.status = "draft";
  state.current = null;
  await rejectsWith(sender.sendTemplate({ ...base, vars: { discount: 1 } }), 409);

  state.status = "published";
  versions.push(
    version(3, "{{discount}} {{code}}", [
      { key: "discount", label: "割引", type: "number", required: true, source: "dispatch" },
      { key: "code", label: "コード", type: "string", required: true, source: "recipient" },
    ]),
  );
  state.current = 3;
  await rejectsWith(sender.sendTemplate({ ...base, vars: { discount: 1 } }), 400, /code/);
  versions.at(-1)!.variables[1].default = "WELCOME";
  const ok = await sender.sendTemplate({ ...base, vars: { discount: 1 } });
  assert.equal(ok.status, "completed");
  assert.equal(world.store.dispatches.at(-1)?.template_version, 3);
});

test("cron の再検査: 回の値が版に合わなければ送らずに止める", async () => {
  const { world, deps, channel, sender } = setup();
  await sender.sendTemplate({ templateId: "tpl-1", recipients: [{ userId: "u1" }], vars: { discount: 10 }, scheduledAt: later(60) });
  world.store.dispatches[0].vars = {};
  deps.setNow(later(60));
  await sweepMessages(deps, deadline());
  assert.equal(channel.calls.length, 0);
  const rows = world.store.deliveries;
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.status === "failed" && row.last_error === "template_vars_invalid"));
});

test("テンプレートの画像は回が複製を持つ(持ち主がテンプレートの画像は回へ attach しない)", async () => {
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
