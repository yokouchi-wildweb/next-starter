// src/app/(user)/(protected)/mypage/account/profile/_screen/MyPageAccountProfileScreen.tsx
// /mypage/account/profile の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditProfile } from "@/features/core/user/components/EditProfile";

import { loadMyPageAccountProfileScreen } from "./loader";

export async function MyPageAccountProfileScreen() {
  const { user, profileData } = await loadMyPageAccountProfileScreen();

  return (
    <>
      <UserPageTitle srOnly>プロフィール編集</UserPageTitle>
      <EditProfile user={user} profileData={profileData ?? undefined} />
    </>
  );
}
