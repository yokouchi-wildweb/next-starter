// メールの経路の項目の検査(描画・送信は偽物、フォールバックの印は本物の描画でも確かめる)
// - 冪等の鍵・件名・宛先を lib/mail の send に渡し、provider の id を返す
// - MailSendError の 3 分類をそのまま写す。それ以外の例外は unknown
// - 描画結果に React のフォールバックの印があれば送らず permanent(L2.1)
// 実行: pnpm test src/features/core/messaging/channels/email
import { test } from "node:test";
import assert from "node:assert/strict";
import { Suspense } from "react";

import { render } from "@react-email/render";

import { MailSendError, type SendMailOptions } from "@/lib/mail";

import { MAIL_THEME_COLORS } from "@/features/core/mail/constants/colors";

import { createEmailChannel } from "./createEmailChannel";
import { hasRenderFallbackMarker } from "./fallback";

const content = { subject: "件名", heading: "見出し", paragraphs: ["本文"], cta: { label: "開く", url: "https://x.test" } };
const target = (address: string, key = `d-${address}`) => ({ userId: "u1", address, idempotencyKey: key, content });

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
