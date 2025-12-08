// src/app/(user)/signup/email-sent/page.tsx

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { VerificationEmailSent } from "@/features/core/auth/components/VerificationEmailSent";

export default function SignUpEmailSentPage() {
  return (
    <UserPage containerType="narrowStack">
      <UserPageTitle>メール送信完了</UserPageTitle>
      <VerificationEmailSent />
      <Para size="sm">
        <Link href="/signup">メールを受け取れていない場合は戻って再送信してください</Link>
      </Para>
    </UserPage>
  );
}
