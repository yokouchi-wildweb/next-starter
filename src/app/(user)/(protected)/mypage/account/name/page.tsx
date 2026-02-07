// src/app/(user)/(protected)/mypage/account/name/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditName } from "@/features/core/user/components/UserMyPage/EditName";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function EditNamePage() {
  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  return (
    <>
      <UserPageTitle srOnly>ユーザー名を編集</UserPageTitle>
      <EditName currentName={user.name} />
    </>
  );
}
