// src/app/(user)/(protected)/mypage/account/notifications/_screen/MyPageAccountNotificationsScreen.tsx
// /mypage/account/notifications の既定画面(通知の設定)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { MessagePreferences } from "@/features/core/messaging/components/MessagePreferences";

import { loadMyPageAccountNotificationsScreen } from "./loader";

export async function MyPageAccountNotificationsScreen(props: ScreenProps) {
  await loadMyPageAccountNotificationsScreen(props);

  return (
    <>
      <UserPageTitle>通知の設定</UserPageTitle>
      <MessagePreferences />
    </>
  );
}
