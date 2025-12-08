// src/app/(user)/(protected)/coins/purchase/failed/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PurchaseFailed } from "@/features/core/purchaseRequest/components/PurchaseFailed";

export default function PurchaseFailedPage() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>購入エラー</UserPageTitle>
      <PurchaseFailed />
    </UserPage>
  );
}
