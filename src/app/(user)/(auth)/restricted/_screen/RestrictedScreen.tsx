// src/app/(user)/(auth)/restricted/_screen/RestrictedScreen.tsx
// /restricted の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// ログイン・status による redirect は loader。suspended は不正確定前のグレー状態のため専用の柔らかい文言を出す。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Para } from "@/components/TextBlocks";

import { loadRestrictedScreen } from "./loader";

export async function RestrictedScreen() {
  const { status } = await loadRestrictedScreen();
  const isSuspended = status === "suspended";

  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      {isSuspended ? (
        <>
          <UserPageTitle>アカウントを確認中です</UserPageTitle>
          <Para align="center">
            ご利用状況の確認のため、現在アカウントのご利用を一時的に停止しております。
          </Para>
          <Para align="center">
            確認が完了次第、改めてご案内いたします。お急ぎの場合や心当たりがない場合は、お手数ですがサポートまでお問い合わせください。
          </Para>
        </>
      ) : (
        <>
          <UserPageTitle>アカウント制限中</UserPageTitle>
          <Para align="center">現在このアカウントはご利用になれません。</Para>
        </>
      )}
    </UserPage>
  );
}
