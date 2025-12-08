// src/app/(user)/(protected)/profile/edit/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PageTitle } from "@/components/TextBlocks";
import UserProfileEdit from "@/features/core/user/components/UserProfileEdit";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserProfileEditPage() {
  const user = await requireCurrentUser();

  return (
    <UserPage containerType="contentShell" space="md">
      <PageTitle>プロフィール編集</PageTitle>
      <UserProfileEdit user={user} />
    </UserPage>
  );
}
