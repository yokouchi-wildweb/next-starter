// src/app/(user)/(auth)/reactivate/page.tsx

import { notFound, redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { Reactivate } from "@/features/core/user/components/Reactivate";

export default async function ReactivatePage() {
  // 休会機能が無効の場合は404
  if (!APP_FEATURES.user.pauseEnabled) {
    notFound();
  }

  const sessionUser = await getSessionUser();

  // 未ログインの場合はログインページへ
  if (!sessionUser) {
    redirect("/login");
  }

  // すでにアクティブな場合はホームへ
  if (sessionUser.status !== "inactive") {
    redirect("/");
  }

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" space="md">
        <UserPageTitle>アカウントの復帰</UserPageTitle>
        <Reactivate />
      </Flex>
    </UserPage>
  );
}
