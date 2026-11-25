// src/domains/core/auth/services/server/signupAudit.test.ts
//
// 登録まわりの失敗の記録(recordSignupFailure)が loginAudit と同じ形と個人情報の方針で audit_logs に書くことの検査(DB なし)。
// - 既知ユーザー: targetId / subjectUserId = user.id、metadata は { flow, reason } だけ(attemptedEmail を持たない)
// - 不明ユーザー: targetId = unknown:<email のハッシュ>、subjectUserId null、attemptedEmail あり。email が無ければ unknown:none
// - action: password_reset は auth.password_reset.failed、ほかは auth.signup.failed / 保持 90 日 / bestEffort
// 実行: pnpm test src/domains/core/auth/services/server/signupAudit.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const recorded: Array<Record<string, unknown>> = [];
mock.module("@/domains/core/auditLog/services/server", {
  namedExports: { auditLogger: { record: async (entry: Record<string, unknown>) => void recorded.push(entry) } },
});

// 429 の記録を区切りごとに 1 回にする数え: 鍵ごとに上限まで通す作り物(本物は rate_limits の表)
const consumed = new Map<string, number>();
const consumeCalls: Array<Record<string, unknown>> = [];
mock.module("@/domains/core/rateLimit/services/server", {
  namedExports: {
    consumeRateLimit: async (input: { key: { scope: string; identifier: string }; rule: { limit: number } }) => {
      consumeCalls.push(input);
      const key = `${input.key.scope}:${input.key.identifier}`;
      const count = consumed.get(key) ?? 0;
      if (count >= input.rule.limit) return { allowed: false, remaining: 0, resetAt: new Date(), count };
      consumed.set(key, count + 1);
      return { allowed: true, remaining: input.rule.limit - count - 1, resetAt: new Date(), count: count + 1 };
    },
  },
});
mock.module("@/domains/core/rateLimit/config", { namedExports: { RATE_LIMIT_CONFIG: { signupRegister: { windowSeconds: 3600, maxRequests: 3 } } } });

let recordSignupFailure: typeof import("./signupAudit").recordSignupFailure;
let signupRejectionRecorder: typeof import("./signupAudit").signupRejectionRecorder;
let hashEmailForAudit: typeof import("@/domains/core/auth/utils/hashEmail").hashEmailForAudit;
before(async () => {
  ({ recordSignupFailure, signupRejectionRecorder } = await import("./signupAudit"));
  ({ hashEmailForAudit } = await import("@/domains/core/auth/utils/hashEmail"));
});
beforeEach(() => {
  recorded.length = 0;
  consumed.clear();
  consumeCalls.length = 0;
});

const request = (body: unknown) => new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify(body) }) as never;

test("既知ユーザー: targetId / subjectUserId は user.id、メールは残さない", async () => {
  await recordSignupFailure({ flow: "register", reason: "already_registered", email: "a@example.test", user: { id: "u1" } as never });
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0], {
    targetType: "user",
    targetId: "u1",
    subjectUserId: "u1",
    action: "auth.signup.failed",
    metadata: { flow: "register", reason: "already_registered" },
    defaultRetentionDays: 90,
    bestEffort: true,
  });
});

test("不明ユーザー: targetId は unknown:<ハッシュ>、試されたメールは metadata(loginAudit と同じ方針)", async () => {
  await recordSignupFailure({ flow: "email_link", reason: "disposable_email", email: "x@spam.test" });
  assert.equal(recorded[0]?.targetId, `unknown:${hashEmailForAudit("x@spam.test")}`);
  assert.equal(recorded[0]?.subjectUserId, null);
  assert.deepEqual(recorded[0]?.metadata, { flow: "email_link", reason: "disposable_email", attemptedEmail: "x@spam.test" });
});

test("メールが取れない時は unknown:none で attemptedEmail を持たない。パスワード再設定は auth.password_reset.failed", async () => {
  await recordSignupFailure({ flow: "password_reset", reason: "invalid_email", email: null });
  assert.equal(recorded[0]?.targetId, "unknown:none");
  assert.equal(recorded[0]?.action, "auth.password_reset.failed");
  assert.deepEqual(recorded[0]?.metadata, { flow: "password_reset", reason: "invalid_email" });
});

test("Factory の 429: 区切りごとに最初の 1 回だけ記録(別の鍵 auth.signupRejectionAudit を上限 1 で数える)、email は本文から", async () => {
  const onRejected = signupRejectionRecorder("register");
  const rejection = { kind: "rateLimit", scope: "ip", category: "signupRegister", identifier: "10.1.2.3" } as const;
  await onRejected(rejection, request({ email: "a@example.test" }));
  await onRejected(rejection, request({ email: "a@example.test" }));
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0]?.metadata, { category: "signupRegister", flow: "register", reason: "rate_limited_ip", attemptedEmail: "a@example.test" });
  assert.deepEqual(consumeCalls[0], {
    key: { scope: "auth.signupRejectionAudit", identifier: "signupRegister:10.1.2.3" },
    rule: { window: "fixed", windowSeconds: 3600, limit: 1 },
  });
});

test("Factory の reCAPTCHA: 毎回記録し、版・誤り・点数を添える。本文が読めなければ email は null", async () => {
  const onRejected = signupRejectionRecorder("email_link");
  await onRejected({ kind: "recaptcha", version: "v3", outcome: "challenge", error: "mid", score: 0.5 }, request("not-json-object"));
  assert.equal(recorded[0]?.targetId, "unknown:none");
  assert.deepEqual(recorded[0]?.metadata, { version: "v3", error: "mid", score: 0.5, flow: "email_link", reason: "recaptcha_challenge" });
});
