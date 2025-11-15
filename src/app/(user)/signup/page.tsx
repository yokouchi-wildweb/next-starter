// src/app/(user)/signup/page.tsx

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle } from "@/components/TextBlocks";
import { Signup } from "@/features/auth/components/Signup";
import { authGuard } from "@/features/auth/services/server/authorization";
import { redirectWithToast } from "@/lib/redirectToast";

export default async function SignUpPage() {
  const sessionUser = await authGuard();

  if (sessionUser) {
    redirectWithToast.info(
      "/",
      "既にログイン済みです。\n再ログインするにはログアウトしてください。",
    );
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
