// src/app/(user)/(protected)/wallet/_screen/WalletIndexScreen.tsx
// /wallet の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletIndexPage } from "@/features/core/wallet/components/WalletIndexPage";

import { loadWalletIndexScreen } from "./loader";

export async function WalletIndexScreen() {
  const data = await loadWalletIndexScreen();

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>ウォレット</UserPageTitle>
        <WalletIndexPage wallets={data.wallets} />
      </Stack>
    </UserPage>
  );
}
