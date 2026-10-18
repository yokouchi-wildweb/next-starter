// src/app/(user)/(protected)/wallet/[slug]/purchase/failed/_screen/WalletPurchaseFailedScreen.tsx
// /wallet/[slug]/purchase/failed の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { PurchaseFailed } from "@/features/core/purchaseRequest/components/PurchaseFailed";

import { loadWalletPurchaseFailedScreen, type WalletPurchaseFailedScreenParams } from "./loader";

export async function WalletPurchaseFailedScreen(props: ScreenProps<WalletPurchaseFailedScreenParams>) {
  const data = await loadWalletPurchaseFailedScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>購入エラー</UserPageTitle>
        <PurchaseFailed slug={data.slug} />
      </Stack>
    </UserPage>
  );
}
