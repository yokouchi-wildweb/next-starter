// src/app/(user)/(protected)/coins/purchase/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { CoinPurchasePage } from "@/features/core/wallet/components/CoinPurchasePage";

export default function CoinPurchasePageRoute() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>コインのご購入</UserPageTitle>
      <CoinPurchasePage />
    </UserPage>
  );
}
