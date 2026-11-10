// src/features/core/purchaseRequest/utils/paymentMethods.test.ts
// 自社振込の振込先口座の書き換え忘れの検査(設定 D68)と、決済の設定を読む関数が既定の値を返すことのテスト。
// 実行: pnpm test src/features/core/purchaseRequest/utils
import { test } from "node:test";
import assert from "node:assert/strict";

import { purchaseRequestConfig, purchaseRequestConfigDef } from "@/features/purchaseRequest/config";

import {
  PLACEHOLDER_BANK_TRANSFER_ACCOUNT,
  assertBankTransferAccountConfigured,
  getProviderSessionExpiryMinutes,
  isPaymentMethodSelectable,
} from "./paymentMethods";

// 上流の既定は compose({}) で見る(読み込んだ purchaseRequestConfig は fork が src/config/features/purchaseRequest.config.ts に書いた値で変わる)
const upstream = purchaseRequestConfigDef.compose({});

const ownAccount = { ...PLACEHOLDER_BANK_TRANSFER_ACCOUNT, bankName: "みずほ銀行", accountNumber: "1234567" };

test("上流の既定の口座は仮の値(検査が比べる値と同じ)", () => {
  assert.deepEqual(upstream.payment.bankTransfer.account, PLACEHOLDER_BANK_TRANSFER_ACCOUNT);
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
  assert.equal(upstream.payment.paymentMethods.find((m) => m.id === "bank_transfer_inhouse")?.status, "disabled");
  assert.equal(upstream.providerDefaultSessionExpiryMinutes, 30);
  assert.equal(upstream.payment.providers.fincode?.sessionExpiryMinutes, undefined);
  assert.equal(upstream.payment.providers.inhouse?.sessionExpiryMinutes, 60 * 24 * 7);
});

test("読む関数は読み込んだ設定(上流 + 上書き)の値を返す", () => {
  const { payment, providerDefaultSessionExpiryMinutes } = purchaseRequestConfig;
  for (const name of Object.keys(payment.providers)) {
    assert.equal(getProviderSessionExpiryMinutes(name), payment.providers[name]?.sessionExpiryMinutes ?? providerDefaultSessionExpiryMinutes);
  }
  assert.equal(getProviderSessionExpiryMinutes("no_such_provider"), providerDefaultSessionExpiryMinutes);
  for (const method of payment.paymentMethods) {
    const expected = method.status === "available" && !!method.provider && Boolean(payment.providers[method.provider]?.enabled);
    assert.equal(isPaymentMethodSelectable(method.id), expected, method.id);
  }
  assert.equal(isPaymentMethodSelectable("no_such_method"), false);
});

test("bankTransferInhouseSelectable(門番の規則が読む値)は isPaymentMethodSelectable と同じ", async () => {
  const { bankTransferInhouseSelectable } = await import("@/features/purchaseRequest/config");
  assert.equal(bankTransferInhouseSelectable, isPaymentMethodSelectable("bank_transfer_inhouse"));
});
