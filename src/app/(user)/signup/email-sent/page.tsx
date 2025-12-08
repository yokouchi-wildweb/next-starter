// src/app/(user)/signup/email-sent/page.tsx

import Link from "next/link";

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Section } from "@/components/Layout/Section";
import { PageTitle, Para } from "@/components/TextBlocks";
import { VerificationEmailSent } from "@/features/core/auth/components/VerificationEmailSent";

export default function SignUpEmailSentPage() {
  return (
    <UserPage containerType="narrowStack">
      <Section as="header">
        <PageTitle>メール送信完了</PageTitle>
      </Section>
      <VerificationEmailSent />
      <Para size="sm">
        <Link href="/signup">メールを受け取れていない場合は戻って再送信してください</Link>
      </Para>
    </UserPage>
  );
}
