// src/app/(user)/(auth)/restricted/page.tsx

import { redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";

export default async function RestrictedPage() {
  const sessionUser = await getSessionUser();

  // 未ログインはログインページへ
  if (!sessionUser) {
    redirect("/login");
  }

  // active はホームへ
  if (sessionUser.status === "active") {
    redirect("/");
  }

  // inactive は復帰ページへ
  if (sessionUser.status === "inactive") {
    redirect("/reactivate");
  }

  // suspended, banned, security_locked のみ表示
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>アカウント制限中</UserPageTitle>
      <Para>現在このアカウントはご利用になれません。</Para>
    </UserPage>
  );
}
