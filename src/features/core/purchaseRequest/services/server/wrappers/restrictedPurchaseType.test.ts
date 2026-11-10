// 購入の制限を確かめる購入の種類(restrictedPurchaseType、設定 D111)の検査。
// 実行: pnpm test src/features/core/purchaseRequest/services/server/wrappers/restrictedPurchaseType.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";

import { restrictedPurchaseType } from "./resolveInitiation";

const request = (purchaseType: string) => ({ purchase_type: purchaseType }) as unknown as PurchaseRequest;

test("新規・再利用は今回の種類、再開は既存の行の種類", () => {
  assert.equal(restrictedPurchaseType({ kind: "create" }, "wallet_topup"), "wallet_topup");
  assert.equal(restrictedPurchaseType({ kind: "reuse-pending", request: request("wallet_topup") }, "wallet_topup"), "wallet_topup");
  assert.equal(restrictedPurchaseType({ kind: "resume", request: request("wallet_topup"), launchType: "redirect" }, "direct_sale"), "wallet_topup");
});

test("済み・競合は確かめない(null)", () => {
  assert.equal(restrictedPurchaseType({ kind: "completed", request: request("wallet_topup") }, "wallet_topup"), null);
  assert.equal(restrictedPurchaseType({ kind: "conflict", request: request("wallet_topup"), reason: "terminal" }, "wallet_topup"), null);
});
