// src/app/(user)/(protected)/mypage/withdraw/_screen/MyPageWithdrawScreen.tsx
// /mypage/withdraw(退会)の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い。未ログインは範囲 (user)/(protected)/guard.ts が弾く)。
// mypage 配下は layout が UserPage を巻くので fragment を返す

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Withdraw } from "@/features/core/user/components/Withdraw";

import { loadMyPageWithdrawScreen } from "./loader";

export async function MyPageWithdrawScreen(props: ScreenProps) {
  await loadMyPageWithdrawScreen(props);

  return (
    <>
      <UserPageTitle srOnly>退会</UserPageTitle>
      <Withdraw />
    </>
  );
}
