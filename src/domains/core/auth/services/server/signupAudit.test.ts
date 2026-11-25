// src/domains/core/auth/services/server/signupAudit.test.ts
//
// 登録まわりの失敗の記録(recordSignupFailure)が loginAudit と同じ形と個人情報の方針で audit_logs に書くことの検査(DB なし)。
// - 既知ユーザー: targetId / subjectUserId = user.id、metadata は { flow, reason } だけ(attemptedEmail を持たない)
// - 不明ユーザー: targetId = unknown:<email のハッシュ>、subjectUserId null、attemptedEmail あり。email が無ければ unknown:none
// - action: password_reset は auth.passwordReset.failed、ほかは auth.signup.failed / 保持 90 日 / bestEffort
// 実行: pnpm test src/domains/core/auth/services/server/signupAudit.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const recorded: Array<Record<string, unknown>> = [];
mock.module("@/domains/core/auditLog/services/server", {
  namedExports: { auditLogger: { record: async (entry: Record<string, unknown>) => void recorded.push(entry) } },
});

let recordSignupFailure: typeof import("./signupAudit").recordSignupFailure;
let hashEmailForAudit: typeof import("@/domains/core/auth/utils/hashEmail").hashEmailForAudit;
before(async () => {
  ({ recordSignupFailure } = await import("./signupAudit"));
  ({ hashEmailForAudit } = await import("@/domains/core/auth/utils/hashEmail"));
});
beforeEach(() => {
  recorded.length = 0;
});

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

test("メールが取れない時は unknown:none で attemptedEmail を持たない。パスワード再設定は auth.passwordReset.failed", async () => {
  await recordSignupFailure({ flow: "password_reset", reason: "invalid_email", email: null });
  assert.equal(recorded[0]?.targetId, "unknown:none");
  assert.equal(recorded[0]?.action, "auth.passwordReset.failed");
  assert.deepEqual(recorded[0]?.metadata, { flow: "password_reset", reason: "invalid_email" });
});
