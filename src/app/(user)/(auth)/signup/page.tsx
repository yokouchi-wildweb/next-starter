// src/app/(user)/(auth)/signup/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Signup } from "@/features/core/auth/components/Signup";

export default async function SignUpPage() {
  const emailSent = "/signup/email-sent";

  return (
    <UserPage containerType="narrowStack">
      <UserPageTitle>ユーザー登録</UserPageTitle>
      <Signup urlAfterEmailSent={emailSent} />
    </UserPage>
  );
}
