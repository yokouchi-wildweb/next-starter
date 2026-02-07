// src/app/(user)/(protected)/mypage/account/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { AccountDetails } from "@/features/core/user/components/UserMyPage/AccountDetails";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function AccountPage() {
  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  return (
    <>
      <UserPageTitle srOnly>アカウント詳細</UserPageTitle>
      <AccountDetails user={user} />
    </>
  );
}
