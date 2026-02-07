// src/app/(user)/(protected)/mypage/account/password/page.tsx

import { redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { EditPassword } from "@/features/core/user/components/UserMyPage/EditPassword";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function EditPasswordPage() {
  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  // パスワード変更はメール認証ユーザーのみ
  if (user.providerType !== "email" || !user.email) {
    redirect("/mypage/account");
  }

  return (
    <>
      <UserPageTitle srOnly>パスワードを変更</UserPageTitle>
      <EditPassword email={user.email} />
    </>
  );
}
