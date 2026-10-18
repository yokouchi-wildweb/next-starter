// src/app/(user)/(protected)/mypage/_screen/MyPageScreen.tsx
// /mypage の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い。未ログインと DB 未登録は (protected)/layout.tsx の authGuard が弾く)。
// mypage 配下は layout が UserPage + Stack + PageTransition を巻くので Screen は fragment を返す。

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { MainMenu } from "@/features/core/user/components/MainMenu";

export function MyPageScreen() {
  return (
    <>
      <UserPageTitle>マイページ</UserPageTitle>
      <MainMenu />
    </>
  );
}
