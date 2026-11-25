// src/app/(user)/(protected)/wallet/[slug]/purchase/callback/_screen/WalletPurchaseCallbackScreen.tsx
// /wallet/[slug]/purchase/callback の既定画面(タイトル無し。ポーリング中の表示だけ)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PurchaseCallback } from "@/domains/core/purchaseRequest/components/PurchaseCallback";
import { createScreen } from "@/wiring/screen";

import { loadWalletPurchaseCallbackScreen } from "./loader";

export const { Screen: WalletPurchaseCallbackScreen, generateMetadata } = createScreen({
  load: loadWalletPurchaseCallbackScreen,
  render: (data) => (
    <UserPage containerType="narrowStack">
      <Stack gap="lg">
        <PurchaseCallback slug={data.slug} />
      </Stack>
    </UserPage>
  ),
});
