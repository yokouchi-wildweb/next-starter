// src/app/(user)/(protected)/mypage/account/profile/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditProfile } from "@/features/core/user/components/UserMyPage/EditProfile";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import type { UserRoleType } from "@/features/core/user/constants";

export default async function EditProfilePage() {
  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  // ロール別プロフィールデータを取得
  const profileData = await userProfileService.getProfile(user.id, user.role as UserRoleType);

  return (
    <>
      <UserPageTitle srOnly>プロフィール編集</UserPageTitle>
      <EditProfile user={user} profileData={profileData ?? undefined} />
    </>
  );
}
