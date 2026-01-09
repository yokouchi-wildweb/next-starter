// src/app/(user)/(protected)/settings/pause/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Pause } from "@/features/core/user/components/Pause";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function PausePage() {
  // 認証確認（未認証の場合は 404）
  await requireCurrentUser({ behavior: "notFound" });

  return (
    <UserPage containerType="narrowStack" space="md">
      <UserPageTitle>休会</UserPageTitle>
      <Pause />
    </UserPage>
  );
}
