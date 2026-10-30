// src/app/(user)/(protected)/mypage/_screen/MyPageScreen.tsx
// /mypage の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い。未ログインは範囲 (user)/(protected)/guard.ts が弾く)。
// mypage 配下は layout が UserPage + Stack + PageTransition を巻くので Screen は fragment を返す。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { MainMenu } from "@/features/core/user/components/MainMenu";

import { loadMyPageScreen } from "./loader";

export async function MyPageScreen(props: ScreenProps) {
  await loadMyPageScreen(props);

  return (
    <>
      <UserPageTitle>マイページ</UserPageTitle>
      <MainMenu />
    </>
  );
}
