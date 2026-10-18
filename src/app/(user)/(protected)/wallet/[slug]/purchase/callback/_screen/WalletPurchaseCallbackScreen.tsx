// src/app/(user)/(protected)/wallet/[slug]/purchase/callback/_screen/WalletPurchaseCallbackScreen.tsx
// /wallet/[slug]/purchase/callback の既定画面(タイトル無し。ポーリング中の表示だけ)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { PurchaseCallback } from "@/features/core/purchaseRequest/components/PurchaseCallback";

import { loadWalletPurchaseCallbackScreen, type WalletPurchaseCallbackScreenParams } from "./loader";

export async function WalletPurchaseCallbackScreen(props: ScreenProps<WalletPurchaseCallbackScreenParams>) {
  const data = await loadWalletPurchaseCallbackScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <PurchaseCallback slug={data.slug} />
      </Stack>
    </UserPage>
  );
}
