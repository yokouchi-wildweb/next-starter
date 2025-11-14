// src/app/(user)/signup/email-sent/page.tsx

import Link from "next/link";

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para } from "@/components/TextBlocks";
import { VerificationEmailSent } from "@/features/auth/components/VerificationEmailSent";

export default function SignUpEmailSentPage() {
  return (
    <Main containerType="narrowStack">
      <Section as="header">
        <PageTitle>メール送信完了</PageTitle>
      </Section>
      <VerificationEmailSent />
      <Para size="sm">
        <Link href="/signup">メールを受け取れていない場合は戻って再送信してください</Link>
      </Para>
    </Main>
  );
}
