// src/app/(user)/(protected)/profile/edit/page.tsx

import { Main, PageTitle } from "@/components/TextBlocks";
import UserProfileEdit from "@/features/core/user/components/UserProfileEdit";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserProfileEditPage() {
  const user = await requireCurrentUser();

  return (
    <Main containerType="contentShell" space="md">
      <PageTitle>プロフィール編集</PageTitle>
      <UserProfileEdit user={user} />
    </Main>
  );
}
