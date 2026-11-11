// src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.test.ts
// リダイレクト先の URL の組み立て(純関数)の回帰: 既定の形・指定のパス・クエリつきのパス・error_code / reason の順
// 実行: pnpm test src/features/core/purchaseRequest

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPurchaseResultUrl } from "./usePurchaseStatusPolling";

test("完了: request_id だけを付ける", () => {
  assert.equal(buildPurchaseResultUrl("/wallet/coin/purchase/complete", { requestId: "r1" }), "/wallet/coin/purchase/complete?request_id=r1");
  assert.equal(buildPurchaseResultUrl("/direct-sale/purchase/complete", { requestId: "r1" }), "/direct-sale/purchase/complete?request_id=r1");
});

test("失敗: request_id → error_code → reason の順(値のあるものだけ)", () => {
  assert.equal(
    buildPurchaseResultUrl("/wallet/coin/purchase/failed", { requestId: "r1", errorCode: "CARD_DECLINED" }),
    "/wallet/coin/purchase/failed?request_id=r1&error_code=CARD_DECLINED",
  );
  assert.equal(
    buildPurchaseResultUrl("/direct-sale/purchase/failed", { requestId: "r1", reason: "timeout" }),
    "/direct-sale/purchase/failed?request_id=r1&reason=timeout",
  );
});

test("パスにクエリがあれば & で続ける", () => {
  assert.equal(
    buildPurchaseResultUrl("/shop/result?kind=failed", { requestId: "r1", reason: "expired" }),
    "/shop/result?kind=failed&request_id=r1&reason=expired",
  );
});
