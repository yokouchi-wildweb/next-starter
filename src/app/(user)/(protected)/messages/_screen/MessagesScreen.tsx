// src/app/(user)/(protected)/messages/_screen/MessagesScreen.tsx
// /messages の既定画面(お知らせの一覧)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { InboxList } from "@/features/core/messaging/components/InboxList";

import { loadMessagesScreen } from "./loader";

export async function MessagesScreen(props: ScreenProps) {
  await loadMessagesScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>お知らせ</UserPageTitle>
        <InboxList />
      </Stack>
    </UserPage>
  );
}
