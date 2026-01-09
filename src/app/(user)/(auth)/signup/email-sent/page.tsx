// src/app/(user)/(auth)/signup/email-sent/page.tsx

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { VerificationEmailSent } from "@/features/core/auth/components/VerificationEmailSent";

export default function SignUpEmailSentPage() {
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
