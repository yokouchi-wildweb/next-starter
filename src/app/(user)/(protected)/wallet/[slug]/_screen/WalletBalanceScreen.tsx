// src/app/(user)/(protected)/wallet/[slug]/_screen/WalletBalanceScreen.tsx
// /wallet/[slug] の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletBalance } from "@/domains/core/wallet/components/WalletBalance";
import { createScreen } from "@/wiring/screen";

import { loadWalletBalanceScreen } from "./loader";

export const { Screen: WalletBalanceScreen, generateMetadata } = createScreen({
  load: loadWalletBalanceScreen,
  render: (data) => (
    <UserPage containerType="narrowStack">
      <Stack gap="lg">
        <UserPageTitle>{data.label}管理</UserPageTitle>
        <WalletBalance
          slug={data.slug}
          phoneVerifiedAt={data.phoneVerifiedAt}
          currentPhoneNumber={data.phoneNumber}
          initialWallets={data.wallets}
        />
      </Stack>
    </UserPage>
  ),
});
