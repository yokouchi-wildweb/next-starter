// src/app/(user)/(protected)/wallet/[slug]/purchase/_screen/WalletPurchaseScreen.tsx
// /wallet/[slug]/purchase の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { WalletPurchase } from "@/domains/core/wallet/components/WalletPurchase";
import { createScreen } from "@/wiring/screen";

import { loadWalletPurchaseScreen } from "./loader";

export const { Screen: WalletPurchaseScreen, generateMetadata } = createScreen({
  load: loadWalletPurchaseScreen,
  render: (data) => (
    <UserPage containerType="narrowStack">
      <Stack gap="lg">
        <UserPageTitle>{data.label}購入</UserPageTitle>
        <WalletPurchase slug={data.slug} />
      </Stack>
    </UserPage>
  ),
});
