// src/app/(user)/signup/verify/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Verification } from "@/features/core/auth/components/Verification";

export default function SignUpVerifyPage() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>メール認証</UserPageTitle>
      <Verification />
    </UserPage>
  );
}
