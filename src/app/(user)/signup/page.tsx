// src/app/(user)/signup/page.tsx

import { redirect } from "next/navigation";

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle } from "@/components/TextBlocks";
import { Signup } from "@/features/auth/components/Signup";
import { authGuard } from "@/features/auth/services/server/authorization";

export default async function SignUpPage() {
  const sessionUser = await authGuard();

  if (sessionUser) {
    redirect("/");
  }

  const emailSent = "/signup/email-sent";

  return (
    <Main containerType="narrowStack">
      <Section as="header">
        <PageTitle>ユーザー登録</PageTitle>
      </Section>
      <Signup urlAfterEmailSent={emailSent} />
    </Main>
  );
}
