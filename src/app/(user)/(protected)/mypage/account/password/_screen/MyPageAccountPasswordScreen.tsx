// src/app/(user)/(protected)/mypage/account/password/_screen/MyPageAccountPasswordScreen.tsx
// /mypage/account/password の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { EditPassword } from "@/features/core/user/components/EditPassword";

import { loadMyPageAccountPasswordScreen } from "./loader";

export async function MyPageAccountPasswordScreen() {
  const { email } = await loadMyPageAccountPasswordScreen();

  return (
    <>
      <UserPageTitle srOnly>パスワードを変更</UserPageTitle>
      <EditPassword email={email} />
    </>
  );
}
