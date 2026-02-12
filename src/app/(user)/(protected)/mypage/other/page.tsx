// src/app/(user)/(protected)/mypage/other/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { OtherActions } from "@/features/core/user/components/UserMyPage/OtherActions";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function OtherActionsPage() {
  await requireCurrentUser({ behavior: "redirect", redirectTo: "/mypage" });

  return (
    <>
      <UserPageTitle srOnly>その他の操作</UserPageTitle>
      <OtherActions />
    </>
  );
}
