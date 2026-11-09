// src/features/core/purchaseRequest/utils/paymentMethods.test.ts
// 自社振込の振込先口座の書き換え忘れの検査(設定 D68)と、決済の設定を読む関数が既定の値を返すことのテスト。
// 実行: pnpm test src/features/core/purchaseRequest/utils
import { test } from "node:test";
import assert from "node:assert/strict";

import { purchaseRequestConfig } from "@/features/purchaseRequest/config";

import {
  PLACEHOLDER_BANK_TRANSFER_ACCOUNT,
  assertBankTransferAccountConfigured,
  getProviderSessionExpiryMinutes,
  isPaymentMethodSelectable,
} from "./paymentMethods";

const ownAccount = { ...PLACEHOLDER_BANK_TRANSFER_ACCOUNT, bankName: "みずほ銀行", accountNumber: "1234567" };

test("上流の既定の口座は仮の値(検査が比べる値と同じ)", () => {
  assert.deepEqual(purchaseRequestConfig.payment.bankTransfer.account, PLACEHOLDER_BANK_TRANSFER_ACCOUNT);
});

test("本番 + 自社振込が選べる + 仮の口座のまま → 止める", () => {
  assert.throws(() => assertBankTransferAccountConfigured(PLACEHOLDER_BANK_TRANSFER_ACCOUNT, true, true), /仮の値のまま/);
});

test("自社の口座を書いていれば本番でも通す", () => {
  assert.doesNotThrow(() => assertBankTransferAccountConfigured(ownAccount, true, true));
});

test("本番でない、または自社振込を使わないなら仮の口座でも通す", () => {
  assert.doesNotThrow(() => assertBankTransferAccountConfigured(PLACEHOLDER_BANK_TRANSFER_ACCOUNT, true, false));
  assert.doesNotThrow(() => assertBankTransferAccountConfigured(PLACEHOLDER_BANK_TRANSFER_ACCOUNT, false, true));
});

test("上流の既定: 自社振込は disabled、セッションの有効期限は既定 30 分・inhouse は 7 日", () => {
  assert.equal(isPaymentMethodSelectable("bank_transfer_inhouse"), false);
  assert.equal(getProviderSessionExpiryMinutes("fincode"), 30);
  assert.equal(getProviderSessionExpiryMinutes("inhouse"), 60 * 24 * 7);
});

test("bankTransferInhouseSelectable(門番の規則が読む値)は payment が開いているとき isPaymentMethodSelectable と同じ", async () => {
  const { bankTransferInhouseSelectable } = await import("@/features/purchaseRequest/config");
  const { APP_FEATURES } = await import("@/config/app/app-features.config");
  assert.equal(APP_FEATURES.payment.enabled && bankTransferInhouseSelectable, isPaymentMethodSelectable("bank_transfer_inhouse"));
});
