// src/app/(user)/(auth)/signup/oauth/_screen/SignupOAuthScreen.tsx
// /signup/oauth の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// provider / returnTo の解釈は loader、認証フローの実行はセクションコンテナ OAuth。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { OAuth } from "@/domains/core/auth/components/OAuth";
import { createScreen } from "@/wiring/screen";

import { loadSignupOAuthScreen } from "./loader";

export const { Screen: SignupOAuthScreen, generateMetadata } = createScreen({
  load: loadSignupOAuthScreen,
  render: ({ provider, redirectTo }) => (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle srOnly>OAuth認証</UserPageTitle>
      <OAuth provider={provider} redirectTo={redirectTo} />
    </UserPage>
  ),
});
