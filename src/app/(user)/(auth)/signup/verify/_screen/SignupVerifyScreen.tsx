// src/app/(user)/(auth)/signup/verify/_screen/SignupVerifyScreen.tsx
// /signup/verify(メール認証リンクの着地)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(メールリンクの検証と遷移はセクションコンテナ Verification が client 側で行う)。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Verification } from "@/features/core/auth/components/Verification";

export function SignupVerifyScreen() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>メール認証</UserPageTitle>
      <Verification />
    </UserPage>
  );
}
