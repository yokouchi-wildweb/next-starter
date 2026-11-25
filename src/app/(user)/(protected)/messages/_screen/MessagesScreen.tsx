// src/app/(user)/(protected)/messages/_screen/MessagesScreen.tsx
// /messages の既定画面(お知らせの一覧)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { InboxList } from "@/domains/core/messaging/components/InboxList";
import { createScreen } from "@/wiring/screen";

import { loadMessagesScreen } from "./loader";

export const { Screen: MessagesScreen, generateMetadata } = createScreen({
  load: loadMessagesScreen,
  render: () => (
    <UserPage containerType="narrowStack">
      <Stack gap="xs">
        <UserPageTitle>お知らせ</UserPageTitle>
        <InboxList />
      </Stack>
    </UserPage>
  ),
});
