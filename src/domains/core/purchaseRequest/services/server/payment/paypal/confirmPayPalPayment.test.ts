// PayPal の確定 API(confirmPayPalPayment)の capture の応答が取れない時の検査(PayPal・DB・完了の処理・監査は偽物)。
// - capture が null でも注文を読み直して COMPLETED なら完了へ進む(capture id を渡す)
// - 読み直しても決まらなければ行に PAYPAL_CAPTURE_UNCONFIRMED を書いて 502、完了の処理は呼ばない
// - capture が取れた時(成功の流れ)は読み直さない
// 実行: pnpm test src/domains/core/purchaseRequest/services/server/payment/paypal/confirmPayPalPayment.test.ts
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";

const ORDER_ID = "ORDER-1";
const request = {
  id: "r1",
  user_id: "u1",
  status: "processing",
  payment_provider: "paypal",
  payment_session_id: ORDER_ID,
  payment_amount: 1000,
  wallet_history_id: null,
};
const order = (status: string, captureId?: string) => ({
  id: ORDER_ID,
  status,
  purchase_units: [
    {
      amount: { value: "1000" },
      payments: captureId ? { captures: [{ id: captureId, status: "COMPLETED" }] } : undefined,
    },
  ],
});

let captureResult: unknown = null;
let fetchResults: unknown[] = [];
let fetchCount = 0;
mock.module("@/domains/core/purchaseRequest/services/server/payment/paypal/paypalProvider", {
  namedExports: {
    paypalPaymentProvider: {
      fetchOrder: async () => {
        fetchCount += 1;
        return fetchResults.shift() ?? null;
      },
      captureOrder: async () => captureResult,
    },
  },
});
mock.module("@/domains/core/purchaseRequest/services/server/drizzleBase", {
  namedExports: { base: { get: async () => request } },
});

const completions: Array<{ transactionId?: string }> = [];
mock.module("@/domains/core/purchaseRequest/services/server/wrappers/completePurchase", {
  namedExports: {
    completePurchase: async (params: { transactionId?: string }) => {
      completions.push(params);
      return { purchaseRequest: { ...request, status: "completed" }, walletHistoryId: "wh1" };
    },
  },
});
mock.module("@/domains/core/purchaseRequest/services/server/wrappers/failPurchase", {
  namedExports: { failPurchase: async () => request },
});
mock.module("@/domains/core/auditLog/services/server", {
  namedExports: { auditLogger: { record: async () => {} } },
});

const updates: Array<Record<string, unknown>> = [];
mock.module("@/lib/drizzle", {
  namedExports: {
    db: {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => void updates.push(values),
        }),
      }),
    },
  },
});

let confirmPayPalPayment: typeof import("./confirmPayPalPayment")["confirmPayPalPayment"];
before(async () => {
  ({ confirmPayPalPayment } = await import("./confirmPayPalPayment"));
});
const params = { purchaseRequestId: "r1", userId: "u1", providerPaymentId: ORDER_ID };

beforeEach(() => {
  captureResult = null;
  fetchResults = [];
  fetchCount = 0;
  completions.length = 0;
  updates.length = 0;
});

test("capture の応答が取れなくても、読み直した注文が COMPLETED なら完了へ進む", async () => {
  fetchResults = [order("APPROVED"), order("COMPLETED", "CAP-1")];
  const result = await confirmPayPalPayment(params);
  assert.equal(result.alreadyCompleted, false);
  assert.deepEqual(completions.map((c) => c.transactionId), ["CAP-1"]);
  assert.deepEqual(updates, []);
});

test("読み直しても決まらなければ行に PAYPAL_CAPTURE_UNCONFIRMED を書いて 502(完了の処理は呼ばない)", async () => {
  fetchResults = [order("APPROVED"), order("APPROVED")];
  await assert.rejects(confirmPayPalPayment(params), (error: unknown) => error instanceof DomainError && error.status === 502);
  assert.deepEqual(completions, []);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].error_code, "PAYPAL_CAPTURE_UNCONFIRMED");
  assert.equal("status" in updates[0], false);
});

test("capture が取れた時(成功の流れ)は読み直さない", async () => {
  fetchResults = [order("APPROVED")];
  captureResult = order("COMPLETED", "CAP-2");
  await confirmPayPalPayment(params);
  assert.equal(fetchCount, 1);
  assert.deepEqual(completions.map((c) => c.transactionId), ["CAP-2"]);
});
