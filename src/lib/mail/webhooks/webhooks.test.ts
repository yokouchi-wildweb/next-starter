// src/lib/mail/webhooks/webhooks.test.ts
//
// lib/mail の webhook の検証と正規化の検査(鍵はテストの中で作る。外部通信なし)。
// - Resend(Svix の HMAC)・SendGrid(ECDSA)の正しい / 改ざん / 古い / 欠けの各分岐
// - 正規化した事件への写し(種類・id・宛先・時刻)
// 実行: pnpm test src/lib/mail/webhooks/webhooks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, randomBytes, sign } from "node:crypto";

import {
  MailWebhookVerifyError,
  normalizeResendWebhook,
  normalizeSendGridWebhook,
  verifyResendWebhook,
  verifySendGridWebhook,
} from "./index";

function expectVerifyError(run: () => unknown, reason: string) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof MailWebhookVerifyError);
    assert.equal(error.reason, reason);
    return true;
  });
}

// --- Resend ---

const secretBytes = randomBytes(24);
const secret = `whsec_${secretBytes.toString("base64")}`;
const now = new Date("2026-11-10T09:00:00Z");
const nowSec = Math.floor(now.getTime() / 1000);

const resendBody = JSON.stringify({
  type: "email.delivered",
  created_at: "2026-11-10T08:59:58.000Z",
  data: {
    email_id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
    created_at: "2026-11-10T08:59:50.000Z",
    to: ["to@example.com"],
    subject: "件名",
  },
});

function svixSign(id: string, ts: number, body: string, key: Buffer = secretBytes): string {
  return createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
}

function resendHeaders(overrides: Record<string, string | undefined> = {}) {
  return {
    "svix-id": "msg_1",
    "svix-timestamp": String(nowSec),
    "svix-signature": `v1,${svixSign("msg_1", nowSec, resendBody)}`,
    ...overrides,
  };
}

test("Resend: 正しい署名を通し、本文と svix-id を返す", () => {
  const verified = verifyResendWebhook({ rawBody: resendBody, headers: resendHeaders(), secret, now });
  assert.equal(verified.svixId, "msg_1");
  assert.equal(verified.payload.type, "email.delivered");
});

test("Resend: Headers でも Uint8Array の本文でも通る", () => {
  const verified = verifyResendWebhook({
    rawBody: new TextEncoder().encode(resendBody),
    headers: new Headers(resendHeaders()),
    secret,
    now,
  });
  assert.equal(verified.svixId, "msg_1");
});

test("Resend: 秘密の切り替え中(署名が複数)はどれか 1 つ合えば通る", () => {
  const other = svixSign("msg_1", nowSec, resendBody, randomBytes(24));
  const headers = resendHeaders({
    "svix-signature": `v1,${other} v1,${svixSign("msg_1", nowSec, resendBody)}`,
  });
  assert.doesNotThrow(() => verifyResendWebhook({ rawBody: resendBody, headers, secret, now }));
});

test("Resend: 本文の改ざんと違う秘密は bad_signature", () => {
  expectVerifyError(
    () => verifyResendWebhook({ rawBody: resendBody.replace("delivered", "bounced"), headers: resendHeaders(), secret, now }),
    "bad_signature",
  );
  expectVerifyError(
    () =>
      verifyResendWebhook({
        rawBody: resendBody,
        headers: resendHeaders(),
        secret: `whsec_${randomBytes(24).toString("base64")}`,
        now,
      }),
    "bad_signature",
  );
});

test("Resend: 5 分より古い timestamp は stale_timestamp", () => {
  const old = nowSec - 301;
  const headers = resendHeaders({
    "svix-timestamp": String(old),
    "svix-signature": `v1,${svixSign("msg_1", old, resendBody)}`,
  });
  expectVerifyError(() => verifyResendWebhook({ rawBody: resendBody, headers, secret, now }), "stale_timestamp");
});

test("Resend: ヘッダが欠けると missing_header", () => {
  expectVerifyError(
    () => verifyResendWebhook({ rawBody: resendBody, headers: resendHeaders({ "svix-id": undefined }), secret, now }),
    "missing_header",
  );
});

test("Resend: 正規化 = 事件 1 件(providerEventId = svix-id、providerMessageId = email_id)", () => {
  const verified = verifyResendWebhook({ rawBody: resendBody, headers: resendHeaders(), secret, now });
  const [event] = normalizeResendWebhook(verified);
  assert.equal(event.provider, "resend");
  assert.equal(event.providerEventId, "msg_1");
  assert.equal(event.providerMessageId, "4ef9a417-02e9-4d39-ad75-9611e0fcc33c");
  assert.equal(event.type, "delivered");
  assert.equal(event.address, "to@example.com");
  assert.equal(event.occurredAt.toISOString(), "2026-11-10T08:59:58.000Z");
});

test("Resend: 種類の写しと、知らない種類は other", () => {
  const cases: Array<[string, string]> = [
    ["email.sent", "sent"],
    ["email.delivery_delayed", "deferred"],
    ["email.bounced", "bounced"],
    ["email.complained", "complained"],
    ["email.opened", "opened"],
    ["email.clicked", "clicked"],
    ["email.failed", "dropped"],
    ["email.suppressed", "dropped"],
    ["contact.created", "other"],
  ];
  for (const [type, expected] of cases) {
    const [event] = normalizeResendWebhook({
      svixId: "msg_x",
      payload: { type, created_at: "2026-11-10T00:00:00Z", data: {} },
    });
    assert.equal(event.type, expected, type);
    assert.equal(event.providerMessageId, null);
  }
});

// --- SendGrid ---

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKeyBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");

const sendgridBody = JSON.stringify([
  {
    email: "to@example.com",
    timestamp: 1762765190,
    event: "delivered",
    sg_event_id: "ev_1",
    sg_message_id: "14c5d75ce93.dfd.64b469.filter0001.16648.5515E0B88.0",
  },
  { email: "to@example.com", timestamp: 1762765200, event: "spamreport", sg_event_id: "ev_2" },
  { email: "to@example.com", timestamp: 1762765210, event: "group_resubscribe", sg_event_id: "ev_3" },
  { email: "to@example.com", timestamp: 1762765220, event: "open" },
]);
const sgTimestamp = "1762765230";

function sgSign(body: string, ts: string = sgTimestamp): string {
  return sign("sha256", Buffer.from(ts + body, "utf8"), privateKey).toString("base64");
}

function sgHeaders(overrides: Record<string, string | undefined> = {}) {
  return {
    "x-twilio-email-event-webhook-signature": sgSign(sendgridBody),
    "x-twilio-email-event-webhook-timestamp": sgTimestamp,
    ...overrides,
  };
}

test("SendGrid: 正しい署名を通し、事件の配列を返す(base64 の DER と PEM の公開鍵)", () => {
  const events = verifySendGridWebhook({ rawBody: sendgridBody, headers: sgHeaders(), publicKey: publicKeyBase64 });
  assert.equal(events.length, 4);
  const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
  assert.doesNotThrow(() =>
    verifySendGridWebhook({ rawBody: sendgridBody, headers: new Headers(sgHeaders()), publicKey: pem }),
  );
});

test("SendGrid: 本文・timestamp の改ざんと違う鍵は bad_signature", () => {
  expectVerifyError(
    () =>
      verifySendGridWebhook({
        rawBody: sendgridBody.replace("delivered", "bounce"),
        headers: sgHeaders(),
        publicKey: publicKeyBase64,
      }),
    "bad_signature",
  );
  expectVerifyError(
    () =>
      verifySendGridWebhook({
        rawBody: sendgridBody,
        headers: sgHeaders({ "x-twilio-email-event-webhook-timestamp": "1762765231" }),
        publicKey: publicKeyBase64,
      }),
    "bad_signature",
  );
  const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey;
  expectVerifyError(
    () =>
      verifySendGridWebhook({
        rawBody: sendgridBody,
        headers: sgHeaders(),
        publicKey: other.export({ format: "der", type: "spki" }).toString("base64"),
      }),
    "bad_signature",
  );
});

test("SendGrid: ヘッダが欠けると missing_header、配列でない本文は bad_payload", () => {
  expectVerifyError(
    () =>
      verifySendGridWebhook({
        rawBody: sendgridBody,
        headers: sgHeaders({ "x-twilio-email-event-webhook-signature": undefined }),
        publicKey: publicKeyBase64,
      }),
    "missing_header",
  );
  const objectBody = JSON.stringify({ event: "delivered" });
  expectVerifyError(
    () =>
      verifySendGridWebhook({
        rawBody: objectBody,
        headers: sgHeaders({ "x-twilio-email-event-webhook-signature": sgSign(objectBody) }),
        publicKey: publicKeyBase64,
      }),
    "bad_payload",
  );
});

test("SendGrid: 正規化 = 配列の 1 件ごと、providerMessageId = sg_message_id の「.」より前、sg_event_id 無しは飛ばす", () => {
  const events = normalizeSendGridWebhook(
    verifySendGridWebhook({ rawBody: sendgridBody, headers: sgHeaders(), publicKey: publicKeyBase64 }),
  );
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((e) => [e.providerEventId, e.type, e.providerMessageId]),
    [
      ["ev_1", "delivered", "14c5d75ce93"],
      ["ev_2", "complained", null],
      ["ev_3", "other", null],
    ],
  );
  assert.equal(events[0].provider, "sendgrid");
  assert.equal(events[0].address, "to@example.com");
  assert.equal(events[0].occurredAt.toISOString(), new Date(1762765190 * 1000).toISOString());
});

test("SendGrid: 種類の写し", () => {
  const cases: Array<[string, string]> = [
    ["processed", "sent"],
    ["deferred", "deferred"],
    ["blocked", "deferred"],
    ["bounce", "bounced"],
    ["dropped", "dropped"],
    ["open", "opened"],
    ["click", "clicked"],
    ["unsubscribe", "unsubscribed"],
    ["group_unsubscribe", "unsubscribed"],
  ];
  for (const [type, expected] of cases) {
    const [event] = normalizeSendGridWebhook([{ event: type, sg_event_id: "e", timestamp: 0 }]);
    assert.equal(event.type, expected, type);
  }
});

test("Resend: bounce の hard / soft(Permanent だけ hard)と tags の読み戻し", () => {
  const kinds: Array<[unknown, string]> = [
    [{ type: "Permanent" }, "hard"],
    [{ type: "Transient" }, "soft"],
    [{ type: "Undetermined" }, "soft"],
    [undefined, "soft"],
  ];
  for (const [bounce, expected] of kinds) {
    const [event] = normalizeResendWebhook({
      svixId: "msg_b",
      payload: { type: "email.bounced", created_at: "2026-11-10T09:00:00Z", data: { email_id: "re_1", bounce } },
    });
    assert.equal(event.bounce, expected);
  }
  const [delivered] = normalizeResendWebhook({
    svixId: "msg_t",
    payload: { type: "email.delivered", created_at: "2026-11-10T09:00:00Z", data: { tags: { delivery_id: "d-1" } } },
  });
  assert.equal(delivered.bounce, undefined);
  assert.deepEqual(delivered.tags, { delivery_id: "d-1" });
  const [listTags] = normalizeResendWebhook({
    svixId: "msg_t2",
    payload: { type: "email.sent", created_at: "2026-11-10T09:00:00Z", data: { tags: [{ name: "delivery_id", value: "d-2" }] } },
  });
  assert.deepEqual(listTags.tags, { delivery_id: "d-2" });
});

test("SendGrid: bounce の type blocked は soft、それ以外は hard。custom_args を tags で読み戻す", () => {
  const [hard, soft, delivered] = normalizeSendGridWebhook([
    { event: "bounce", type: "bounce", sg_event_id: "e1", timestamp: 0 },
    { event: "bounce", type: "blocked", sg_event_id: "e2", timestamp: 0 },
    { event: "delivered", sg_event_id: "e3", timestamp: 0, delivery_id: "d-9", "smtp-id": "<x>" },
  ]);
  assert.equal(hard.bounce, "hard");
  assert.equal(soft.bounce, "soft");
  assert.equal(delivered.bounce, undefined);
  assert.deepEqual(delivered.tags, { delivery_id: "d-9" });
});
