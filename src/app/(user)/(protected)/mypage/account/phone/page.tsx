// src/app/(user)/(protected)/mypage/account/phone/page.tsx

import { redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { EditPhone } from "@/features/core/user/components/UserMyPage/EditPhone";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function EditPhonePage() {
  // 電話番号認証機能が無効の場合はアカウント詳細にリダイレクト
  if (!APP_FEATURES.user.phoneVerificationEnabled) {
    redirect("/mypage/account");
  }

  const user = await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  return (
    <>
      <UserPageTitle srOnly>電話番号認証</UserPageTitle>
      <EditPhone
        phoneNumber={user.phoneNumber}
        phoneVerifiedAt={user.phoneVerifiedAt}
      />
    </>
  );
}
