// src/app/(user)/(public)/unsubscribe/_screen/UnsubscribeScreen.tsx
// /unsubscribe の既定画面(メールの配信停止の確認と結果)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { Unsubscribe } from "@/features/core/messaging/components/Unsubscribe";

import { loadUnsubscribeScreen, type UnsubscribeScreenSearchParams } from "./loader";

export async function UnsubscribeScreen(props: ScreenProps<Record<string, never>, UnsubscribeScreenSearchParams>) {
  const data = await loadUnsubscribeScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>配信停止</UserPageTitle>
        <Unsubscribe {...data} />
      </Stack>
    </UserPage>
  );
}
