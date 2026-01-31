// src/app/(user)/(auth)/signup/page.tsx

import { redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Signup } from "@/features/core/auth/components/Signup";

export default async function SignUpPage() {
  // 事前登録モードの場合は事前登録ページへリダイレクト
  if (APP_FEATURES.auth.signup.mode === "earlyRegistration") {
    redirect("/entry");
  }

  const emailSent = "/signup/email-sent";

  return (
    <UserPage containerType="narrowStack">
      <UserPageTitle>ユーザー登録</UserPageTitle>
      <Signup urlAfterEmailSent={emailSent} />
    </UserPage>
  );
}
