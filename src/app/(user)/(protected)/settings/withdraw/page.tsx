// src/app/(user)/(protected)/settings/withdraw/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Withdraw } from "@/features/core/user/components/Withdraw";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function WithdrawPage() {
  // 認証確認（未認証の場合は 404）
  await requireCurrentUser({ behavior: "notFound" });

  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>退会</UserPageTitle>
      <Withdraw />
    </UserPage>
  );
}
