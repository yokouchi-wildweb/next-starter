// src/app/(user)/signup/page.tsx

import { redirect } from "next/navigation";

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Section } from "@/components/Layout/Section";
import { PageTitle } from "@/components/TextBlocks";
import { Signup } from "@/features/core/auth/components/Signup";
import { authGuard } from "@/features/core/auth/services/server/authorization";

export default async function SignUpPage() {

  const emailSent = "/signup/email-sent";

  return (
    <UserPage containerType="narrowStack">
      <Section as="header">
        <PageTitle>ユーザー登録</PageTitle>
      </Section>
      <Signup urlAfterEmailSent={emailSent} />
    </UserPage>
  );
}
