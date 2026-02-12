// src/app/(user)/(protected)/mypage/withdraw/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { Withdraw } from "@/features/core/user/components/Withdraw";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function WithdrawPage() {
  await requireCurrentUser({ behavior: "redirect", redirectTo: "/mypage" });

  return (
    <>
      <UserPageTitle srOnly>退会</UserPageTitle>
      <Withdraw />
    </>
  );
}
