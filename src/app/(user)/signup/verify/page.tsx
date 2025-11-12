// src/app/(user)/signup/verify/page.tsx

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle } from "@/components/TextBlocks";
import { Verification } from "../../../../features/auth/components/Verification";

export default function SignUpVerifyPage() {
  return (
    <Main containerType="narrowStack">
      <Section as="header">
        <PageTitle>メール認証</PageTitle>
      </Section>
      <Verification />
    </Main>
  );
}
