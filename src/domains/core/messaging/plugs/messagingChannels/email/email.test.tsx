// メールの送信チャンネルの項目の検査(描画・送信は偽物、フォールバックの印は本物の描画でも確かめる)
// - 冪等の鍵・件名・宛先を lib/mail の send に渡し、provider の id を返す
// - 描くのは宛先ごとに 1 回。描いた html をそのまま send に渡す(react は渡さない)
// - MailSendError の 3 分類をそのまま写す。それ以外の例外は unknown
// - 描画結果に React のフォールバックの印があれば送らず permanent(L2.1)
// - 本文の停止のリンク: 好みのページが開(preferencesPageUrl が値)ならそこ、閉ならワンクリックの URL。ヘッダは同じ
// - 送る口が組んだ中身(MessageLayoutContent)を段に従って描く: レイアウトのメールの描き方 > 汎用 > 要約。件名 = 題。形が違う・描き方が無い = permanent render_failed
// - 受信者(recipient): 利用者の宛先だけレイアウトの描き方に表示名を渡す(send の 1 回で 1 度引く)。引けなければ送らず transient
// 実行: pnpm test src/domains/core/messaging/plugs/messagingChannels/email
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { Suspense, type ReactElement } from "react";

import { render } from "@react-email/render";

import { MAIL_THEME_COLORS, MailSendError, type SendMailOptions } from "@/lib/mail";

import type { MessageKey, MessageLayoutContent } from "@/lib/messaging";

import { layoutEmails, layouts } from "@/domains/core/messaging/services/server/lists";

import { WebhookNotConfiguredError } from "@/domains/core/messaging/services/server/webhooks/errors";
import { createEmailChannel, toChannelWebhookEvent } from "./createEmailChannel";
import { hasRenderFallbackMarker } from "./fallback";
/** 送る口が組む中身(レイアウト notice、レイアウトのメールの描き方の段) */
const values = {
  subject: "件名",
  blocks: [
    { type: "heading" as const, text: "見出し" },
    { type: "paragraph" as const, text: "本文" },
    { type: "button" as const, label: "開く", url: "https://x.test" },
  ],
};
const content: MessageLayoutContent = {
  title: "件名",
  layout: "notice",
  from: "layout",
  values,
  summary: layouts.notice!.summary(values),
};
const LAYOUT_DEPS = { layouts, layoutEmails };
const target = (address: string, key = `d-${address}`, messageKey: MessageKey = "shop.notice") => ({
  userId: "u1",
  address,
  messageKey,
  idempotencyKey: key,
  content,
});

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
    ...LAYOUT_DEPS,
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

test("描くのは宛先ごとに 1 回で、描いた html をそのまま send に渡す", async () => {
  let renders = 0;
  const sent: SendMailOptions[] = [];
  const channel = createEmailChannel({
    render: async (element) => {
      renders += 1;
      return `<p>${renders}</p>${await render(element)}`;
    },
    send: async (mail) => {
      sent.push(mail);
      return { provider: "resend", providerMessageId: null };
    },
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    ...LAYOUT_DEPS,
  });
  await channel.send([target("a@example.test"), target("b@example.test")]);
  assert.equal(renders, 2);
  assert.ok(sent[0].html?.startsWith("<p>1</p>") && sent[1].html?.startsWith("<p>2</p>"));
  assert.ok(sent.every((mail) => mail.react === undefined));
});

test("レイアウトのメールの描き方で欄を描く(見出し・本文・ボタン)", async () => {
  const { channel } = setup();
  let html = "";
  const spy = createEmailChannel({
    render: async (element) => (html = await render(element)),
    send: async () => ({ provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    ...LAYOUT_DEPS,
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
    ...LAYOUT_DEPS,
  });
  const headers = {
    "List-Unsubscribe": "<https://app.example.test/api/messaging/unsubscribe?token=abc>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const [result] = await channel.send([{ ...target("a@example.test"), category: "marketing", headers }]);
  assert.equal(result.kind, "sent");
  assert.deepEqual(sent[0].headers, headers);
  assert.ok(html.includes("https://app.example.test/unsubscribe?token=abc"), "本文のリンクは同じトークンの確認のページ");
  assert.ok(!html.includes("/api/messaging/unsubscribe"), "本文に One-Click の API は出さない");
  assert.ok(html.includes("配信停止"));
});

test("好みのページが開: 本文のリンクは好みのページ、ヘッダはワンクリックのまま。閉なら確認のページ", async () => {
  const oneClick = "https://app.example.test/api/messaging/unsubscribe?token=abc";
  const headers = { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  for (const page of ["https://app.example.test/mypage/account/notifications", null]) {
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
      ...LAYOUT_DEPS,
      preferencesPageUrl: () => page,
    });
    const [result] = await channel.send([{ ...target("a@example.test"), category: "marketing", headers }]);
    assert.equal(result.kind, "sent");
    assert.deepEqual(sent[0].headers, headers);
    if (page) {
      assert.ok(html.includes(page));
      assert.ok(!html.includes(oneClick));
    } else {
      assert.ok(html.includes("https://app.example.test/unsubscribe?token=abc"));
      assert.ok(!html.includes(oneClick));
    }
  }
});

test("取引の連絡(ヘッダなし)は好みのページが開でも本文にリンクを出さない", async () => {
  let html = "";
  const channel = createEmailChannel({
    render: async (element) => (html = await render(element)),
    send: async () => ({ provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    ...LAYOUT_DEPS,
    preferencesPageUrl: () => "https://app.example.test/mypage/account/notifications",
  });
  await channel.send([target("t@example.test")]);
  assert.ok(!html.includes("/mypage/account/notifications"));
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

test("webhook: Resend の署名を確かめ、送信チャンネルの事件(bounced_hard / bounced_soft、タグの配達の id)に正規化する", async () => {
  const secretBytes = randomBytes(24);
  const channel = createEmailChannel({
    render: async () => "<html></html>",
    send: async () => ({ provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => `whsec_${secretBytes.toString("base64")}`, sendgridPublicKey: () => null },
    ...LAYOUT_DEPS,
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

test("描き方の 3 段: レイアウトの描き方・汎用(レイアウトの email の欄を宣言の順に)・要約から。件名は題", async () => {
  const htmls: string[] = [];
  const sent: SendMailOptions[] = [];
  const channel = createEmailChannel({
    render: async (element) => {
      const html = await render(element);
      htmls.push(html);
      return html;
    },
    send: async (mail) => (sent.push(mail), { provider: "resend", providerMessageId: null }),
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    ...LAYOUT_DEPS,
  });
  const generic = { ...content, from: "channel" as const };
  const summary = { ...content, title: "要約の題", from: "summary" as const, summary: { title: "要約の題", body: "要約の本文", link: { url: "https://x.test/s" } } };
  const results = await channel.send([
    { ...target("a@x", "d1"), content },
    { ...target("b@x", "d2"), content: generic },
    { ...target("c@x", "d3"), content: summary },
  ]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "sent", "sent"]);
  assert.ok(htmls[0].includes("見出し") && htmls[0].includes("https://x.test"));
  assert.ok(htmls[1].includes("件名") && htmls[1].includes("本文") && htmls[1].includes("https://x.test"));
  assert.ok(htmls[2].includes("要約の本文") && htmls[2].includes("https://x.test/s"));
  assert.deepEqual(sent.map((mail) => mail.subject), ["件名", "件名", "要約の題"]);
});

test("中身の形が違う・レイアウトの描き方が無い → 送らず permanent render_failed", async () => {
  const { channel, sent } = setup();
  const results = await channel.send([
    { ...target("a@x", "d1"), content: { subject: "前の経路の欄" } },
    { ...target("b@x", "d2"), content: { ...content, layout: "nope" } },
  ]);
  assert.deepEqual(
    results.map((r) => r.kind !== "sent" && r.reason),
    ["render_failed", "render_failed"],
  );
  assert.equal(sent.length, 0);
});

test("プレビュー: 送る時と同じ描き方で HTML を返し、カテゴリーがあれば停止のリンクの見本を出す", async () => {
  const { channel } = setup();
  const plain = await channel.preview!({ messageKey: "shop.notice", content });
  assert.ok(plain.html?.includes("見出し") && plain.html.includes("https://x.test"));
  assert.ok(!plain.html?.includes("#unsubscribe"));
  const marketing = await channel.preview!({ messageKey: "shop.notice", content, category: "marketing" });
  assert.ok(marketing.html?.includes("#unsubscribe"));
});

test("受信者: レイアウトの描き方に利用者の表示名を渡す(send の 1 回で 1 度引く)。利用者の居ない宛先・プレビューには渡さない", async () => {
  const seen: unknown[] = [];
  const lookups: (readonly string[])[] = [];
  const Probe = (props: { recipient?: { displayName: string | null } }) => {
    seen.push(props.recipient);
    return <p>{props.recipient?.displayName ?? "-"} 様</p>;
  };
  const sent: SendMailOptions[] = [];
  const channel = createEmailChannel({
    render: (element) => render(element),
    send: async (mail) => {
      sent.push(mail);
      return { provider: "resend", providerMessageId: null };
    },
    findEmails: async () => [],
    findRecipients: async (userIds) => {
      lookups.push(userIds);
      return new Map([["u1", { displayName: "山田" }]]);
    },
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    layouts,
    layoutEmails: { notice: { layout: "notice", Component: Probe as never } },
  });
  const results = await channel.send([target("a@example.test", "d1"), { ...target("b@example.test", "d2"), userId: "u1" }, { ...target("c@example.test", "d3"), userId: null }]);
  assert.deepEqual(results.map((r) => r.kind), ["sent", "sent", "sent"]);
  assert.deepEqual(lookups, [["u1"]], "重ねた利用者 id は 1 つにまとめ、1 度だけ引く");
  assert.deepEqual(seen, [{ displayName: "山田" }, { displayName: "山田" }, undefined]);
  assert.match(sent[0]!.html, /山田/);
  seen.length = 0;
  await channel.preview!({ messageKey: "shop.notice", content });
  assert.deepEqual(seen, [undefined]);
});

test("受信者を引けなければ、その回の宛先は送らず transient recipient_lookup_failed。findRecipients が無ければ今までどおり", async () => {
  const sent: SendMailOptions[] = [];
  const base = {
    render: (element: ReactElement) => render(element),
    send: async (mail: SendMailOptions) => {
      sent.push(mail);
      return { provider: "resend", providerMessageId: null };
    },
    findEmails: async () => [],
    theme: MAIL_THEME_COLORS,
    webhookKeys: { resendSecret: () => null, sendgridPublicKey: () => null },
    ...LAYOUT_DEPS,
  };
  const failing = createEmailChannel({ ...base, findRecipients: async () => Promise.reject(new Error("db down")) });
  const results = await failing.send([target("a@example.test", "d1")]);
  assert.deepEqual(results, [{ address: "a@example.test", kind: "transient", reason: "recipient_lookup_failed", message: "db down" }]);
  assert.equal(sent.length, 0);
  const plain = createEmailChannel(base);
  assert.deepEqual((await plain.send([target("a@example.test", "d1")])).map((r) => r.kind), ["sent"]);
});
