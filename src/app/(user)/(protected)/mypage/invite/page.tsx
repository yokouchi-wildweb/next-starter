// src/app/(user)/(protected)/mypage/invite/page.tsx

import { redirect } from "next/navigation";
import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { InviteCodePage } from "@/features/core/referral/components/common/InviteCodePage";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function InviteCodePageRoute() {
  if (!APP_FEATURES.marketing.referral.enabled) {
    redirect("/mypage");
  }

  await requireCurrentUser({
    behavior: "redirect",
    redirectTo: "/mypage",
  });

  return (
    <>
      <UserPageTitle srOnly>招待コード</UserPageTitle>
      <InviteCodePage />
    </>
  );
}
