// メールの経路の項目の検査(描画・送信は偽物、フォールバックの印は本物の描画でも確かめる)
// - 冪等の鍵・件名・宛先を lib/mail の send に渡し、provider の id を返す
// - MailSendError の 3 分類をそのまま写す。それ以外の例外は unknown
// - 描画結果に React のフォールバックの印があれば送らず permanent(L2.1)
// - 宛先の連絡の鍵で生成の一覧の描き方(messages/views の EmailView)を使う。無ければ既定、読めなければ permanent
// 実行: pnpm test src/features/core/messaging/channels/email
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { Suspense } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS, MailSendError, type SendMailOptions } from "@/lib/mail";

import type { MessageKey, MessageRegistry } from "@/lib/messaging";

import { WebhookNotConfiguredError } from "../../services/server/webhooks/errors";
import { createEmailChannel, toChannelWebhookEvent } from "./createEmailChannel";
import { hasRenderFallbackMarker } from "./fallback";
import { loadRegistryView } from "./loadView";
import type { EmailViewProps } from "./view";

const content = { subject: "件名", heading: "見出し", paragraphs: ["本文"], cta: { label: "開く", url: "https://x.test" } };
const target = (address: string, key = `d-${address}`, messageKey: MessageKey = "shop.notice") => ({
  userId: "u1",
  address,
  messageKey,
  idempotencyKey: key,
  content,
});
const noView = async () => null;

function setup(options: { html?: string; fail?: (to: string) => unknown } = {}) {
  const sent: SendMailOptions[] = [];
  const channel = createEmailChannel({
    render: async (element) => options.html ?? (await render(element)),
    send: async (mail) => {
      const error = options.fail?.(mail.to);
      if (error) throw error;
      sent.push(mail);
      return { provider: "resend", providerMessageId: `pm-${mail.to}` };
    },
    findEmails: async (userIds) => userIds.map((userId) => ({ userId, address: `${userId}@example.test` })),
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    loadView: noView,
  });
  return { channel, sent };
}

test("宛先・件名・冪等の鍵を lib/mail の send に渡し、provider の id を返す", async () => {
  const { channel, sent } = setup();
  const results = await channel.send([target("a@example.test", "d1"), target("b@example.test", "d2:1")]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "sent"]);
  assert.deepEqual(sent.map((m) => [m.to, m.subject, m.idempotencyKey]), [
    ["a@example.test", "件名", "d1"],
    ["b@example.test", "件名", "d2:1"],
  ]);
  assert.equal(results[0].kind === "sent" && results[0].providerMessageId, "pm-a@example.test");
  assert.deepEqual(await channel.resolveAddresses!(["u1"]), [{ userId: "u1", address: "u1@example.test" }]);
  assert.equal(channel.key, "email");
});

test("既定の描き方は欄を描く(見出し・本文・ボタン)", async () => {
  const { channel } = setup();
  let html = "";
  const spy = createEmailChannel({
    render: async (element) => (html = await render(element)),
    send: async () => ({ provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    loadView: noView,
  });
  await spy.send([target("a@example.test")]);
  assert.ok(html.includes("見出し") && html.includes("本文") && html.includes("https://x.test"));
  assert.ok(!hasRenderFallbackMarker(html));
  assert.ok(channel);
});

test("MailSendError の分類を写し、他の例外は unknown", async () => {
  const kinds = { "t@x": "transient", "p@x": "permanent", "u@x": "unknown" } as const;
  const { channel } = setup({
    fail: (to) =>
      to in kinds
        ? new MailSendError({ message: "失敗", kind: kinds[to as keyof typeof kinds], provider: "resend", status: 500 })
        : new Error("boom"),
  });
  const results = await channel.send([target("t@x"), target("p@x"), target("u@x"), target("other@x")]);
  assert.deepEqual(results.map((r) => r.kind), ["transient", "permanent", "unknown", "unknown"]);
  assert.equal(results[0].kind !== "sent" && results[0].reason, "http_500");
  assert.equal(results[3].kind !== "sent" && results[3].reason, "send_threw");
});

test("描画結果にフォールバックの印があれば送らず permanent(L2.1)", async () => {
  const { channel, sent } = setup({ html: '<html><body><!--$!--><template data-msg="x"></template><!--/$--></body></html>' });
  const [result] = await channel.send([target("a@example.test")]);
  assert.deepEqual({ kind: result.kind, reason: "reason" in result ? result.reason : null }, {
    kind: "permanent",
    reason: "render_fallback",
  });
  assert.equal(sent.length, 0);
});

test("本物の描画: Suspense の中で部品が投げると印が出て、それを見つける", async () => {
  function Broken(): never {
    throw new Error("部品の誤り");
  }
  const html = await render(
    <html>
      <body>
        <Suspense fallback={<p>読み込み中</p>}>
          <Broken />
        </Suspense>
      </body>
    </html>,
  );
  assert.ok(hasRenderFallbackMarker(html), html);
});

test("好みに従う連絡: List-Unsubscribe のヘッダを渡し、本文に停止のリンクを出す", async () => {
  let html = "";
  const sent: SendMailOptions[] = [];
  const channel = createEmailChannel({
    render: async (element) => (html = await render(element)),
    send: async (mail) => {
      sent.push(mail);
      return { provider: "resend", providerMessageId: null };
    },
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    loadView: noView,
  });
  const headers = {
    "List-Unsubscribe": "<https://app.example.test/api/messaging/unsubscribe?t=abc>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const [result] = await channel.send([{ ...target("a@example.test"), category: "marketing", headers }]);
  assert.equal(result.kind, "sent");
  assert.deepEqual(sent[0].headers, headers);
  assert.ok(html.includes("https://app.example.test/api/messaging/unsubscribe?t=abc"));
  assert.ok(html.includes("配信停止"));
});

test("category があるのに List-Unsubscribe が無い(鍵が無い)→ 送らず permanent unsubscribe_key_missing。取引は送る", async () => {
  const { channel, sent } = setup();
  const results = await channel.send([{ ...target("m@example.test"), category: "marketing" }, target("t@example.test")]);
  assert.deepEqual(
    results.map((r) => [r.kind, "reason" in r ? r.reason : null]),
    [
      ["permanent", "unsubscribe_key_missing"],
      ["sent", null],
    ],
  );
  assert.deepEqual(sent.map((m) => [m.to, m.headers]), [["t@example.test", undefined]]);
});

test("送る時に配達の id を provider のタグで渡す(D36)", async () => {
  const { channel, sent } = setup();
  await channel.send([target("a@example.test", "d-123:1")]);
  assert.deepEqual(sent[0].tags, { delivery_id: "d-123" });
});

test("webhook: Resend の署名を確かめ、経路の事件(bounced_hard / bounced_soft、タグの配達の id)に正規化する", async () => {
  const secretBytes = randomBytes(24);
  const channel = createEmailChannel({
    render: async () => "<html></html>",
    send: async () => ({ provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => `whsec_${secretBytes.toString("base64")}`, sendgridPublicKey: () => null },
    loadView: noView,
  });
  const body = JSON.stringify({
    type: "email.bounced",
    created_at: new Date().toISOString(),
    data: { email_id: "re_1", to: ["a@example.test"], bounce: { type: "Permanent" }, tags: { delivery_id: "d-9" } },
  });
  const id = "msg_1";
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secretBytes).update(`${id}.${ts}.${body}`).digest("base64");
  const headers = new Headers({ "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${signature}` });
  const webhook = channel.webhooks!.resend;
  const [event] = webhook.normalize(await webhook.verify({ rawBody: body, headers }));
  assert.deepEqual(
    { type: event.type, providerMessageId: event.providerMessageId, deliveryId: event.deliveryId, address: event.address },
    { type: "bounced_hard", providerMessageId: "re_1", deliveryId: "d-9", address: "a@example.test" },
  );
  assert.throws(() => webhook.verify({ rawBody: `${body} `, headers }));
  assert.equal(
    toChannelWebhookEvent({ provider: "sendgrid", providerMessageId: null, providerEventId: "e", type: "bounced", bounce: "soft", address: null, occurredAt: new Date(0), raw: {} }).type,
    "bounced_soft",
  );
});

test("webhook: 鍵(env)が無ければ WebhookNotConfiguredError(受け口は 503)", () => {
  const { channel } = setup();
  assert.throws(() => channel.webhooks!.resend.verify({ rawBody: "{}", headers: new Headers() }), WebhookNotConfiguredError);
  assert.throws(() => channel.webhooks!.sendgrid.verify({ rawBody: "[]", headers: new Headers() }), WebhookNotConfiguredError);
});

function OwnView({ content: fields }: EmailViewProps) {
  return <p>独自の描き方 {fields.heading}</p>;
}

test("連絡の鍵で生成の一覧の描き方を使い、無い連絡は既定の描き方。読むのは束で 1 回", async () => {
  const registry: MessageRegistry = {
    "shop.notice": {
      key: "shop.notice",
      definition: async () => ({ message: {} as never }),
      view: async () => ({ EmailView: OwnView }),
    },
    "shop.plain": { key: "shop.plain", definition: async () => ({ message: {} as never }) },
  };
  const htmls: string[] = [];
  const loaded: string[] = [];
  const channel = createEmailChannel({
    render: async (element) => {
      const html = await render(element);
      htmls.push(html);
      return html;
    },
    send: async () => ({ provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    loadView: (messageKey) => {
      loaded.push(messageKey);
      return loadRegistryView(registry, messageKey);
    },
  });
  const results = await channel.send([
    target("a@x", "d1", "shop.notice"),
    target("b@x", "d2", "shop.notice"),
    target("c@x", "d3", "shop.plain"),
    target("d@x", "d4", "shop.unknown"),
  ]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "sent", "sent", "sent"]);
  assert.ok(htmls[0].includes("独自の描き方") && htmls[1].includes("独自の描き方"));
  assert.ok(!htmls[2].includes("独自の描き方") && htmls[2].includes("本文"));
  assert.ok(htmls[3].includes("本文"));
  assert.deepEqual(loaded, ["shop.notice", "shop.plain", "shop.unknown"]);
});

test("描き方が読めない・EmailView が無い → 送らず permanent render_failed", async () => {
  const registry: MessageRegistry = {
    "shop.broken": {
      key: "shop.broken",
      definition: async () => ({ message: {} as never }),
      view: async () => ({}) as never,
    },
    "shop.throws": {
      key: "shop.throws",
      definition: async () => ({ message: {} as never }),
      view: async () => {
        throw new Error("import failed");
      },
    },
  };
  const sent: SendMailOptions[] = [];
  const channel = createEmailChannel({
    render: (element) => render(element),
    send: async (mail) => {
      sent.push(mail);
      return { provider: "resend", providerMessageId: null };
    },
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    loadView: (messageKey) => loadRegistryView(registry, messageKey),
  });
  const results = await channel.send([target("a@x", "d1", "shop.broken"), target("b@x", "d2", "shop.throws")]);
  assert.deepEqual(
    results.map((r) => r.kind !== "sent" && r.reason),
    ["render_failed", "render_failed"],
  );
  assert.equal(sent.length, 0);
});
