// src/app/(user)/(protected)/wallet/[slug]/purchase/awaiting-review/_screen/WalletPurchaseAwaitingReviewScreen.tsx
// 銀行振込の申告後、運営の確認待ち(通貨未付与)の案内画面。confirm API の redirectUrl から遷移してくる。
// 上流所有。下流は編集・削除せず、差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (loader の import は ../_screen/loader に直す)。手順: src/lib/screens/README.md

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { PurchaseAwaitingReview } from "@/features/core/purchaseRequest/components/PurchaseAwaitingReview";

import {
  loadWalletPurchaseAwaitingReviewScreen,
  type WalletPurchaseAwaitingReviewScreenParams,
} from "./loader";

export async function WalletPurchaseAwaitingReviewScreen(
  props: ScreenProps<WalletPurchaseAwaitingReviewScreenParams>,
) {
  const data = await loadWalletPurchaseAwaitingReviewScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>お振込みの確認待ち</UserPageTitle>
        <PurchaseAwaitingReview slug={data.slug} />
      </Stack>
    </UserPage>
  );
}
