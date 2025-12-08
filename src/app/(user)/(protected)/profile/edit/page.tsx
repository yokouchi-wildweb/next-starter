// src/app/(user)/(protected)/profile/edit/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import UserProfileEdit from "@/features/core/user/components/UserProfileEdit";
import { requireCurrentUser } from "@/features/core/user/services/server/requireCurrentUser";

export default async function UserProfileEditPage() {
  const user = await requireCurrentUser();

  return (
    <UserPage containerType="contentShell" space="md">
      <UserPageTitle>プロフィール編集</UserPageTitle>
      <UserProfileEdit user={user} />
    </UserPage>
  );
}
