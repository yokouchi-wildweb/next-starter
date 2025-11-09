// src/app/(user)/signup/verify/page.tsx

import { Main, PageTitle, Section } from "@/components/TextBlocks";
import { Verification } from "../../../../features/auth/components/Verification";

export default function SignUpVerifyPage() {
  return (
    <Main variant="narrowStack">
      <Section as="header">
        <PageTitle>メール認証</PageTitle>
      </Section>
      <Verification />
    </Main>
  );
}
