// src/app/(user)/(auth)/signup/email-sent/_screen/SignupEmailSentScreen.tsx
// /signup/email-sent(認証メール送信完了)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(送信先の表示と再送はセクションコンテナ VerificationEmailSent が client 側で扱う)。

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { VerificationEmailSent } from "@/features/core/auth/components/VerificationEmailSent";

export function SignupEmailSentScreen() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>メール送信完了</UserPageTitle>
      <VerificationEmailSent />
      <Para size="sm">
        <Link href="/signup">新規登録ページへ戻る »</Link>
      </Para>
    </UserPage>
  );
}
