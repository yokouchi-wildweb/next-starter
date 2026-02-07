// src/app/(user)/(protected)/mypage/account/email/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditEmail } from "@/features/core/user/components/UserMyPage/EditEmail";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function EditEmailPage() {
  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  return (
    <>
      <UserPageTitle srOnly>メールアドレスを編集</UserPageTitle>
      <EditEmail currentEmail={user.email} />
    </>
  );
}
