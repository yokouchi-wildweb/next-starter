// src/app/(user)/(protected)/wallet/[slug]/history/_screen/WalletHistoryScreen.tsx
// /wallet/[slug]/history の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import type { ScreenProps } from "@/lib/screens/types";
import { WalletHistory } from "@/features/core/wallet/components/WalletHistory";

import { loadWalletHistoryScreen, type WalletHistoryScreenParams } from "./loader";

export async function WalletHistoryScreen(props: ScreenProps<WalletHistoryScreenParams>) {
  const data = await loadWalletHistoryScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>{data.label}履歴</UserPageTitle>
        <WalletHistory slug={data.slug} />
      </Stack>
    </UserPage>
  );
}
