// src/app/(user)/(protected)/wallet/[slug]/purchase/_screen/WalletPurchaseScreen.tsx
// /wallet/[slug]/purchase の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { WalletPurchase } from "@/features/core/wallet/components/WalletPurchase";

import { loadWalletPurchaseScreen, type WalletPurchaseScreenParams } from "./loader";

export async function WalletPurchaseScreen(props: ScreenProps<WalletPurchaseScreenParams>) {
  const data = await loadWalletPurchaseScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{data.label}購入</UserPageTitle>
        <WalletPurchase slug={data.slug} />
      </Stack>
    </UserPage>
  );
}
