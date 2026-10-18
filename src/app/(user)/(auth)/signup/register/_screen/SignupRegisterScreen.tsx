// src/app/(user)/(auth)/signup/register/_screen/SignupRegisterScreen.tsx
// /signup/register の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// method の解釈は loader、フォームはセクションコンテナ Registration。

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Registration } from "@/features/core/auth/components/Registration";
import type { ScreenProps } from "@/lib/screens/types";

import { loadSignupRegisterScreen, type SignupRegisterScreenSearchParams } from "./loader";

export async function SignupRegisterScreen(
  props: ScreenProps<Record<string, never>, SignupRegisterScreenSearchParams>,
) {
  const { method } = await loadSignupRegisterScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <UserPageTitle srOnly>本登録</UserPageTitle>
      <Registration method={method} />
    </UserPage>
  );
}
