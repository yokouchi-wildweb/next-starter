// src/app/(user)/(protected)/wallet/_screen/WalletIndexScreen.tsx
// /wallet の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletList } from "@/features/core/wallet/components/WalletList";

import { loadWalletIndexScreen } from "./loader";

export async function WalletIndexScreen(props: ScreenProps) {
  const data = await loadWalletIndexScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>ウォレット</UserPageTitle>
        <WalletList wallets={data.wallets} />
      </Stack>
    </UserPage>
  );
}
