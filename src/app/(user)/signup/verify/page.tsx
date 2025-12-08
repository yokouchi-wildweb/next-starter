// src/app/(user)/signup/verify/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Section } from "@/components/Layout/Section";
import { PageTitle } from "@/components/TextBlocks";
import { Verification } from "@/features/core/auth/components/Verification";

export default function SignUpVerifyPage() {
  return (
    <UserPage containerType="narrowStack">
      <Section as="header">
        <PageTitle>メール認証</PageTitle>
      </Section>
      <Verification />
    </UserPage>
  );
}
