// src/app/(user)/(protected)/mypage/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import UserMyPageView from "@/features/core/user/components/UserMyPage";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserMyPagePage() {
  const user = await requireCurrentUser();

  return (
    <UserPage containerType="contentShell" space="md">
      <UserPageTitle>マイページ</UserPageTitle>
      <UserMyPageView user={user} />
    </UserPage>
  );
}
