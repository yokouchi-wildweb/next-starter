// src/app/(user)/(protected)/mypage/account/phone/_screen/MyPageAccountPhoneScreen.tsx
// /mypage/account/phone の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { EditPhone } from "@/features/core/user/components/EditPhone";

import { loadMyPageAccountPhoneScreen } from "./loader";

export async function MyPageAccountPhoneScreen() {
  const { phoneNumber, phoneVerifiedAt } = await loadMyPageAccountPhoneScreen();

  return (
    <>
      <UserPageTitle srOnly>電話番号認証</UserPageTitle>
      <EditPhone phoneNumber={phoneNumber} phoneVerifiedAt={phoneVerifiedAt} />
    </>
  );
}
