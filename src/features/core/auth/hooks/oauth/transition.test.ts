// src/features/core/auth/hooks/oauth/transition.test.ts
//
// OAuth の phase → 遷移の決め方（resolveOAuthTransition）の単体テスト。
// 実行: pnpm test:auth-registration-flow

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OAUTH_ALREADY_REGISTERED_TOAST, resolveOAuthTransition } from "./transition";
import type { OAuthPhase } from "./types";

const paths = { afterVerificationPath: "/signup/register", redirectTo: "/mypage" };

describe("resolveOAuthTransition", () => {
  it("completed = afterVerificationPath?method=thirdParty へ遷移ガード経由で進む", () => {
    assert.deepEqual(resolveOAuthTransition("completed", false, paths), {
      kind: "push",
      path: "/signup/register?method=thirdParty",
    });
  });

  it("alreadyRegistered + 休会中 = /reactivate へ置き換え、トーストなし", () => {
    assert.deepEqual(resolveOAuthTransition("alreadyRegistered", true, paths), {
      kind: "replace",
      path: "/reactivate",
    });
  });

  it("alreadyRegistered = トースト + redirectTo へ置き換え", () => {
    assert.deepEqual(resolveOAuthTransition("alreadyRegistered", false, paths), {
      kind: "replace",
      path: "/mypage",
      toast: OAUTH_ALREADY_REGISTERED_TOAST,
    });
    assert.equal(OAUTH_ALREADY_REGISTERED_TOAST, "登録済みユーザーでログインしました");
  });

  it("他の phase = 何もしない", () => {
    const others: OAuthPhase[] = ["initial", "redirecting", "processing", "invalidProcess"];
    for (const phase of others) {
      assert.equal(resolveOAuthTransition(phase, true, paths), null);
      assert.equal(resolveOAuthTransition(phase, false, paths), null);
    }
  });
});
