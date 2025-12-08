// src/app/(user)/(protected)/coins/purchase/callback/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PurchaseCallback } from "@/features/core/purchaseRequest/components/PurchaseCallback";

export default function PurchaseCallbackPage() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <PurchaseCallback />
    </UserPage>
  );
}
