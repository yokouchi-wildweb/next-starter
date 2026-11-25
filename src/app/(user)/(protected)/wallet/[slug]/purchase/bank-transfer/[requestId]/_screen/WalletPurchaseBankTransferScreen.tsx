// src/app/(user)/(protected)/wallet/[slug]/purchase/bank-transfer/[requestId]/_screen/WalletPurchaseBankTransferScreen.tsx
// 自社受付の銀行振込(inhouse プロバイダ)の振込案内画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { BankTransferInstruction } from "@/domains/core/purchaseRequest/components/BankTransferInstruction";
import { createScreen } from "@/wiring/screen";

import { loadWalletPurchaseBankTransferScreen } from "./loader";

export const { Screen: WalletPurchaseBankTransferScreen, generateMetadata } = createScreen({
  load: loadWalletPurchaseBankTransferScreen,
  render: (data) => (
    <UserPage containerType="narrowStack">
      <Stack gap="sm">
        <UserPageTitle>銀行振込のご案内</UserPageTitle>
        <BankTransferInstruction
          requestId={data.requestId}
          paymentAmount={data.paymentAmount}
          account={data.account}
          identifier={data.identifier}
          expiresAt={data.expiresAt}
          aiImageJudgmentEnabled={data.aiImageJudgmentEnabled}
          aiImageJudgmentStrictMode={data.aiImageJudgmentStrictMode}
          currencyLabel={data.currencyLabel}
        />
      </Stack>
    </UserPage>
  ),
});
