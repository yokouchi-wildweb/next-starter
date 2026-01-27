// src/app/(user)/(auth)/email/verify/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";

import { EmailChangeVerification } from "./_components/EmailChangeVerification";

export default function EmailVerifyPage() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>メールアドレス変更</UserPageTitle>
      <EmailChangeVerification />
    </UserPage>
  );
}
