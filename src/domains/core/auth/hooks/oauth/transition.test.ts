// src/domains/core/auth/hooks/oauth/transition.test.ts
//
// OAuth の phase → 遷移の決め方（resolveOAuthTransition）の単体テスト。
// 実行: pnpm test src/domains/core/auth/hooks/oauth/transition.test.ts

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveOAuthTransition } from "./transition";
import type { OAuthPhase } from "./types";

const paths = { afterVerificationPath: "/signup/register", redirectTo: "/mypage" };

describe("resolveOAuthTransition", () => {
  it("completed = afterVerificationPath?method=thirdParty へ遷移ガード経由で進む", () => {
    assert.deepEqual(resolveOAuthTransition("completed", false, paths), {
      kind: "push",
      path: "/signup/register?method=thirdParty",
    });
  });

  it("alreadyRegistered + 休会中 = /reactivate へ読み直し", () => {
    assert.deepEqual(resolveOAuthTransition("alreadyRegistered", true, paths), {
      kind: "reload",
      path: "/reactivate",
    });
  });

  it("alreadyRegistered = redirectTo へ読み直し(利用者が替わる、D139)", () => {
    assert.deepEqual(resolveOAuthTransition("alreadyRegistered", false, paths), {
      kind: "reload",
      path: "/mypage",
    });
  });

  it("他の phase = 何もしない", () => {
    const others: OAuthPhase[] = ["initial", "redirecting", "processing", "invalidProcess"];
    for (const phase of others) {
      assert.equal(resolveOAuthTransition(phase, true, paths), null);
      assert.equal(resolveOAuthTransition(phase, false, paths), null);
    }
  });
});
