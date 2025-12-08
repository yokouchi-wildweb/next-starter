// src/app/(user)/(protected)/coins/purchase/complete/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PurchaseComplete } from "@/features/core/purchaseRequest/components/PurchaseComplete";

export default function PurchaseCompletePage() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>購入完了</UserPageTitle>
      <PurchaseComplete />
    </UserPage>
  );
}
