// src/app/(user)/(auth)/signup/_screen/SignupScreen.tsx
// /signup(ユーザー登録の入口)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い。事前登録モード時の /signup → /entry は Proxy 層(redirectProxy)が担う。
// メール送信後の遷移先はこの Screen の定数(差し替え Screen で変えられる)。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Signup } from "@/features/core/auth/components/Signup";

/** 認証メール送信後の遷移先 */
const URL_AFTER_EMAIL_SENT = "/signup/email-sent";

export function SignupScreen() {
  return (
    <UserPage containerType="narrowStack">
      <UserPageTitle>ユーザー登録</UserPageTitle>
      <Signup urlAfterEmailSent={URL_AFTER_EMAIL_SENT} />
    </UserPage>
  );
}
