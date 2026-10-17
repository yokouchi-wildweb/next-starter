// src/app/(user)/(protected)/wallet/[slug]/_screen/WalletBalanceScreen.tsx
// /wallet/[slug] の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { WalletBalancePage } from "@/features/core/wallet/components/WalletBalancePage";
import {
  loadWalletBalanceScreen,
  type WalletBalanceScreenParams,
} from "@/features/core/wallet/services/server/loaders/walletBalance";

export async function WalletBalanceScreen(props: ScreenProps<WalletBalanceScreenParams>) {
  const data = await loadWalletBalanceScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{data.label}管理</UserPageTitle>
        <WalletBalancePage
          slug={data.slug}
          phoneVerifiedAt={data.phoneVerifiedAt}
          currentPhoneNumber={data.phoneNumber}
        />
      </Stack>
    </UserPage>
  );
}
