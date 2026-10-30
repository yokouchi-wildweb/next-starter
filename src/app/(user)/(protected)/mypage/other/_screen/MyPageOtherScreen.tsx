// src/app/(user)/(protected)/mypage/other/_screen/MyPageOtherScreen.tsx
// /mypage/other(その他の操作)の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い。未ログインは範囲 (user)/(protected)/guard.ts が弾く)。
// mypage 配下は layout が UserPage を巻くので fragment を返す

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { OtherActions } from "@/features/core/user/components/OtherActions";

import { loadMyPageOtherScreen } from "./loader";

export async function MyPageOtherScreen(props: ScreenProps) {
  await loadMyPageOtherScreen(props);

  return (
    <>
      <UserPageTitle srOnly>その他の操作</UserPageTitle>
      <OtherActions />
    </>
  );
}
