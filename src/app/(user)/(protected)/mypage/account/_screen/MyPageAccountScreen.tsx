// src/app/(user)/(protected)/mypage/account/_screen/MyPageAccountScreen.tsx
// /mypage/account の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { AccountDetails } from "@/domains/core/user/components/AccountDetails";
import { createScreen } from "@/wiring/screen";

import { loadMyPageAccountScreen } from "./loader";

export const { Screen: MyPageAccountScreen, generateMetadata } = createScreen({
  load: loadMyPageAccountScreen,
  render: ({ user }) => (
    <>
      <UserPageTitle srOnly>アカウント基本情報</UserPageTitle>
      <AccountDetails user={user} />
    </>
  ),
});
