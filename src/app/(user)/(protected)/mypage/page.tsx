// src/app/(user)/(protected)/mypage/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PageTitle } from "@/components/TextBlocks";
import UserMyPageView from "@/features/core/user/components/UserMyPage";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserMyPagePage() {
  const user = await requireCurrentUser();

  return (
    <UserPage containerType="contentShell" space="md">
      <PageTitle>マイページ</PageTitle>
      <UserMyPageView user={user} />
    </UserPage>
  );
}
