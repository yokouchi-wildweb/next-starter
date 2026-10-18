// src/app/(user)/(protected)/mypage/account/email/_screen/MyPageAccountEmailScreen.tsx
// /mypage/account/email の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditEmail } from "@/features/core/user/components/UserMyPage/EditEmail";

import { loadMyPageAccountEmailScreen } from "./loader";

export async function MyPageAccountEmailScreen() {
  const { email } = await loadMyPageAccountEmailScreen();

  return (
    <>
      <UserPageTitle srOnly>メールアドレスを編集</UserPageTitle>
      <EditEmail currentEmail={email} />
    </>
  );
}
