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
  // suspended は不正確定前のグレー状態のため、専用の柔らかい文言を出す
  const isSuspended = sessionUser.status === "suspended";

  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      {isSuspended ? (
        <>
          <UserPageTitle>アカウントを確認中です</UserPageTitle>
          <Para>
            ご利用状況の確認のため、現在アカウントのご利用を一時的に停止しております。
          </Para>
          <Para>
            確認が完了次第、改めてご案内いたします。お急ぎの場合や心当たりがない場合は、お手数ですがサポートまでお問い合わせください。
          </Para>
        </>
      ) : (
        <>
          <UserPageTitle>アカウント制限中</UserPageTitle>
          <Para>現在このアカウントはご利用になれません。</Para>
        </>
      )}
    </UserPage>
  );
}
