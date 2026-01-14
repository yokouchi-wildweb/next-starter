// src/app/(user)/(protected)/profile/edit/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import UserProfileEdit from "@/features/core/user/components/UserProfileEdit";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import type { UserRoleType } from "@/features/core/user/constants";

export default async function UserProfileEditPage() {
  const user = await requireCurrentUser();

  // プロフィールデータを取得
  const profileData = await userProfileService.getProfile(user.id, user.role as UserRoleType);

  return (
    <UserPage containerType="contentShell" space="md">
      <UserPageTitle>プロフィール編集</UserPageTitle>
      <UserProfileEdit user={user} profileData={profileData ?? undefined} />
    </UserPage>
  );
}
