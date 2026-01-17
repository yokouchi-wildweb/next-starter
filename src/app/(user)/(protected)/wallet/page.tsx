// src/app/(user)/(protected)/wallet/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletIndexPage } from "@/features/core/wallet/components/WalletIndexPage";

export default function WalletPageRoute() {
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>ウォレット</UserPageTitle>
        <WalletIndexPage />
      </Stack>
    </UserPage>
  );
}
