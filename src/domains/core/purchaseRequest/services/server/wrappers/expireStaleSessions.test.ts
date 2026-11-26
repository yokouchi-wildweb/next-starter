// 放置された client_sdk の processing 行の片付け(settleStaleClientSdkSession)の検査。
// 照合・DB・クォータ・戦略は偽物: 照らした結果ごとに、完了・失敗はそのまま返し、決まらない物だけ expired にし、照会の失敗は行を残す
// 実行: pnpm test src/domains/core/purchaseRequest/services/server/wrappers/expireStaleSessions.test.ts
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import type { PurchaseRequest } from "@/domains/core/purchaseRequest/entities/model";

type Outcome = { kind: "completed" | "failed" | "open"; request: PurchaseRequest };
let reconcile: (row: PurchaseRequest) => Promise<Outcome> = async (row) => ({ kind: "open", request: row });
mock.module("@/domains/core/purchaseRequest/services/server/wrappers/reconcileWithProvider", {
  namedExports: { reconcileWithProvider: (row: PurchaseRequest) => reconcile(row) },
});

const calls: string[] = [];
mock.module("@/lib/drizzle", {
  namedExports: { db: { transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}) } },
});
mock.module("@/domains/core/purchaseRequest/services/server/wrappers/transitionStatus", {
  namedExports: {
    transitionStatus: async (args: { id: string; to: string; from: string[] }) => {
      calls.push(`transition ${args.id} ${args.from.join(",")}→${args.to}`);
      return true;
    },
  },
});
mock.module("@/domains/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper", {
  namedExports: { releaseQuota: async (id: string) => void calls.push(`release ${id}`) },
});
mock.module("@/domains/core/purchaseRequest/services/server/completion", {
  namedExports: { getPurchaseCompletionStrategy: () => ({ onExpire: async () => void calls.push("onExpire") }) },
});
mock.module("@/domains/core/purchaseRequest/services/server/payment", {
  namedExports: { getPaymentProvider: () => ({ launchType: "client_sdk" }) },
});

let settleStaleClientSdkSession: typeof import("./expireStaleSessions")["settleStaleClientSdkSession"];
before(async () => {
  ({ settleStaleClientSdkSession } = await import("./expireStaleSessions"));
});

const row = { id: "r1", status: "processing", payment_provider: "paypal", purchase_type: "wallet_topup" } as unknown as PurchaseRequest;

beforeEach(() => {
  calls.length = 0;
  mock.method(console, "error", () => {});
});

test("プロバイダが払いを確かめた行は完了のまま(expired にしない)", async () => {
  reconcile = async (r) => ({ kind: "completed", request: { ...r, status: "completed" } });
  assert.equal(await settleStaleClientSdkSession(row), "completed");
  assert.deepEqual(calls, []);
});

test("プロバイダが失敗と言った行は failed のまま(expired にしない)", async () => {
  reconcile = async (r) => ({ kind: "failed", request: { ...r, status: "failed" } });
  assert.equal(await settleStaleClientSdkSession(row), "failed");
  assert.deepEqual(calls, []);
});

test("決まらない行(承認だけ・未承認)だけ expired にし、onExpire とクォータの解放を同じ tx で", async () => {
  reconcile = async (r) => ({ kind: "open", request: r });
  assert.equal(await settleStaleClientSdkSession(row), "expired");
  assert.deepEqual(calls, ["transition r1 processing→expired", "onExpire", "release r1"]);
});

test("照会が throw した行は触らない(kept、次の回に照らす)", async () => {
  reconcile = async () => {
    throw new Error("PayPal unreachable");
  };
  assert.equal(await settleStaleClientSdkSession(row), "kept");
  assert.deepEqual(calls, []);
});
