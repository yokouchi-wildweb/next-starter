// src/app/(user)/(protected)/wallet/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { WalletIndexPage } from "@/features/core/wallet/components/WalletIndexPage";

export default function WalletPageRoute() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>ウォレット</UserPageTitle>
      <WalletIndexPage />
    </UserPage>
  );
}
