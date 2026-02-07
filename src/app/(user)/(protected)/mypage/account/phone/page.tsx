// src/app/(user)/(protected)/mypage/account/phone/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditPhone } from "@/features/core/user/components/UserMyPage/EditPhone";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function EditPhonePage() {
  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  return (
    <>
      <UserPageTitle srOnly>電話番号認証</UserPageTitle>
      <EditPhone
        phoneNumber={user.phoneNumber}
        phoneVerifiedAt={user.phoneVerifiedAt}
      />
    </>
  );
}
