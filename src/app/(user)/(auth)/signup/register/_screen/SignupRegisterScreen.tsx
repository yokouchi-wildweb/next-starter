// src/app/(user)/(auth)/signup/register/_screen/SignupRegisterScreen.tsx
// /signup/register の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// method の解釈は loader、フォームはセクションコンテナ Registration。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Registration } from "@/domains/core/auth/components/Registration";
import { createScreen } from "@/wiring/screen";

import { loadSignupRegisterScreen } from "./loader";

export const { Screen: SignupRegisterScreen, generateMetadata } = createScreen({
  load: loadSignupRegisterScreen,
  render: ({ method }) => (
    <UserPage containerType="narrowStack">
      <UserPageTitle srOnly>本登録</UserPageTitle>
      <Registration method={method} />
    </UserPage>
  ),
});
