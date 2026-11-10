// 購入の制限のサーバーでの強制(assertWalletPurchaseAllowed、設定 D111)の検査(DB なし)。設定・門番・userService を差し替える。
// 実行: pnpm test src/features/core/wallet/services/server/wrappers/purchaseRestriction.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";

const state = {
  restriction: "none" as "none" | "phoneVerified",
  gateOpen: true,
  user: null as Record<string, unknown> | null,
  lookups: 0,
};

mock.module("@/features/wallet/config", {
  namedExports: {
    walletConfig: {
      get purchaseRestriction() {
        return state.restriction;
      },
    },
  },
});
mock.module("@/featureGate", { namedExports: { gate: { enabled: () => state.gateOpen } } });
mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    userService: {
      get: async () => {
        state.lookups += 1;
        return state.user;
      },
    },
  },
});

let assertWalletPurchaseAllowed: typeof import("./purchaseRestriction").assertWalletPurchaseAllowed;
before(async () => {
  ({ assertWalletPurchaseAllowed } = await import("./purchaseRestriction"));
});
beforeEach(() => {
  state.restriction = "none";
  state.gateOpen = true;
  state.user = { id: "u1", phoneVerifiedAt: null };
  state.lookups = 0;
});

const statusOf = async () => {
  try {
    await assertWalletPurchaseAllowed({ userId: "u1" });
    return 0;
  } catch (error) {
    assert.ok(error instanceof DomainError);
    return error.status;
  }
};

test("none: 何もしない(利用者も引かない)", async () => {
  assert.equal(await statusOf(), 0);
  assert.equal(state.lookups, 0);
});

test("phoneVerified: 未認証は 403、認証済みは通る", async () => {
  state.restriction = "phoneVerified";
  assert.equal(await statusOf(), 403);
  state.user = { id: "u1", phoneVerifiedAt: new Date("2026-11-01T00:00:00Z") };
  assert.equal(await statusOf(), 0);
});

test("phoneVerified で SMS 認証の機能が閉: 黙って通さず 403", async () => {
  state.restriction = "phoneVerified";
  state.gateOpen = false;
  state.user = { id: "u1", phoneVerifiedAt: new Date() };
  assert.equal(await statusOf(), 403);
  assert.equal(state.lookups, 0);
});

test("phoneVerified で利用者がいなければ 404", async () => {
  state.restriction = "phoneVerified";
  state.user = null;
  assert.equal(await statusOf(), 404);
});
