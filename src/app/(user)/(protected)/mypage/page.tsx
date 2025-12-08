// src/app/(user)/(protected)/mypage/page.tsx

import { Main, PageTitle } from "@/components/TextBlocks";
import UserMyPageView from "@/features/core/user/components/UserMyPage";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserMyPagePage() {
  const user = await requireCurrentUser();

  return (
    <Main containerType="contentShell" space="md">
      <PageTitle>マイページ</PageTitle>
      <UserMyPageView user={user} />
    </Main>
  );
}
