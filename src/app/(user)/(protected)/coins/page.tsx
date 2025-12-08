// src/app/(user)/(protected)/coins/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { CoinBalancePage } from "@/features/core/wallet/components/CoinBalancePage";

export default function CoinsPageRoute() {
  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>コイン管理</UserPageTitle>
      <CoinBalancePage />
    </UserPage>
  );
}
