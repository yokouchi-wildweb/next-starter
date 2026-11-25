// src/app/(user)/(protected)/wallet/[slug]/purchase/failed/_screen/WalletPurchaseFailedScreen.tsx
// /wallet/[slug]/purchase/failed の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PurchaseFailed } from "@/domains/core/purchaseRequest/components/PurchaseFailed";
import { createScreen } from "@/wiring/screen";

import { loadWalletPurchaseFailedScreen } from "./loader";

export const { Screen: WalletPurchaseFailedScreen, generateMetadata } = createScreen({
  load: loadWalletPurchaseFailedScreen,
  render: (data) => (
    <UserPage containerType="narrowStack">
      <Stack gap="lg">
        <UserPageTitle>購入エラー</UserPageTitle>
        <PurchaseFailed slug={data.slug} />
      </Stack>
    </UserPage>
  ),
});
