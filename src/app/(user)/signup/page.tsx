// src/app/(user)/signup/page.tsx

import { Main, PageTitle, Section } from "@/components/TextBlocks";
import { Signup } from "@/features/auth/components/Signup";

export default function SignUpPage() {

  const emailSent = "/signup/email-sent";

  return (
    <Main variant="narrowStack">
      <Section as="header">
        <PageTitle>ユーザー登録</PageTitle>
      </Section>
      <Signup urlAfterEmailSent={emailSent} />
    </Main>
  );
}
