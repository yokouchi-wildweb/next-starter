// src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.test.ts
// リダイレクト先の URL の組み立て(純関数)の回帰: 既定の形・指定のパス・クエリつきのパス・error_code / reason の順。
// 引数の型の形(slug は行き先を省くときだけ要る)も pnpm typecheck がここで見る(隣の .test.tsx は同じ名前の .ts があるので tsc が読まない)
// 実行: pnpm test src/features/core/purchaseRequest

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPurchaseResultUrl, type UsePurchaseStatusPollingParams } from "./usePurchaseStatusPolling";

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

// 型の形(pnpm typecheck が見る): 行き先を両方渡すか slug を渡せば通り、片方の行き先だけで slug 無しは誤り
const typeCases: UsePurchaseStatusPollingParams[] = [
  { requestId: "r1", completePath: "/a", failedPath: "/b" },
  { requestId: "r1", slug: "coin" },
  { requestId: "r1", slug: "coin", completePath: "/a" },
  // @ts-expect-error -- failedPath を省くなら slug が要る
  { requestId: "r1", completePath: "/a" },
  // @ts-expect-error -- completePath を省くなら slug が要る
  { requestId: "r1", failedPath: "/b" },
];

test("引数の型の形の例は 5 つ(誤りの 2 つは pnpm typecheck が止める)", () => {
  assert.equal(typeCases.length, 5);
});
