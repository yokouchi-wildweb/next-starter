// src/app/(user)/(protected)/mypage/pause/page.tsx

import { notFound } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { Pause } from "@/features/core/user/components/Pause";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function PausePage() {
  // 休会機能が無効の場合は404
  if (!APP_FEATURES.user.pauseEnabled) {
    notFound();
  }

  await requireCurrentUser({ behavior: "redirect", redirectTo: "/mypage" });

  return (
    <>
      <UserPageTitle srOnly>休会</UserPageTitle>
      <Pause />
    </>
  );
}
