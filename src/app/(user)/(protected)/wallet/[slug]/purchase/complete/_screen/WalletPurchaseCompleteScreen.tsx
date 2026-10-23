// src/app/(user)/(protected)/wallet/[slug]/purchase/complete/_screen/WalletPurchaseCompleteScreen.tsx
// /wallet/[slug]/purchase/complete の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { PurchaseComplete } from "@/features/core/purchaseRequest/components/PurchaseComplete";

import { loadWalletPurchaseCompleteScreen, type WalletPurchaseCompleteScreenParams } from "./loader";

export async function WalletPurchaseCompleteScreen(props: ScreenProps<WalletPurchaseCompleteScreenParams>) {
  const data = await loadWalletPurchaseCompleteScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>購入完了</UserPageTitle>
        <PurchaseComplete slug={data.slug} />
      </Stack>
    </UserPage>
  );
}
