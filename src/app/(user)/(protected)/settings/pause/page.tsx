// src/app/(user)/(protected)/settings/pause/page.tsx

import { notFound } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { Pause } from "@/features/core/user/components/Pause";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function PausePage() {
  // 休会機能が無効の場合は404
  if (!APP_FEATURES.user.pauseEnabled) {
    notFound();
  }

  // 認証確認（未認証の場合は 404）
  await requireCurrentUser({ behavior: "notFound" });

  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <UserPageTitle>休会</UserPageTitle>
        <Pause />
      </Stack>
    </UserPage>
  );
}
