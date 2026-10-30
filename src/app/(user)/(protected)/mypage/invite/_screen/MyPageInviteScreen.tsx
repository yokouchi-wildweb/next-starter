// src/app/(user)/(protected)/mypage/invite/_screen/MyPageInviteScreen.tsx
// /mypage/invite の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { InviteCode } from "@/features/core/referral/components/InviteCode";

import { loadMyPageInviteScreen } from "./loader";

export async function MyPageInviteScreen(props: ScreenProps) {
  await loadMyPageInviteScreen(props);

  return (
    <>
      <UserPageTitle srOnly>招待コード</UserPageTitle>
      <InviteCode />
    </>
  );
}
