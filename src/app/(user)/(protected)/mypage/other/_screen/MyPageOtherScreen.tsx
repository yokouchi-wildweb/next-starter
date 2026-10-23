// src/app/(user)/(protected)/mypage/other/_screen/MyPageOtherScreen.tsx
// /mypage/other(その他の操作)の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い。未ログインは (protected)/layout.tsx の authGuard が弾く)。
// mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { OtherActions } from "@/features/core/user/components/OtherActions";

export function MyPageOtherScreen() {
  return (
    <>
      <UserPageTitle srOnly>その他の操作</UserPageTitle>
      <OtherActions />
    </>
  );
}
