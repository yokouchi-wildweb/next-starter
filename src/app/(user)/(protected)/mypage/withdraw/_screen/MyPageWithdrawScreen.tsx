// src/app/(user)/(protected)/mypage/withdraw/_screen/MyPageWithdrawScreen.tsx
// /mypage/withdraw(退会)の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い。未ログインは範囲 (user)/(protected)/guard.ts が弾く)。
// mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Withdraw } from "@/domains/core/accountLifecycle/components/Withdraw";
import { createScreen } from "@/wiring/screen";

import { loadMyPageWithdrawScreen } from "./loader";

export const { Screen: MyPageWithdrawScreen, generateMetadata } = createScreen({
  load: loadMyPageWithdrawScreen,
  render: () => (
    <>
      <UserPageTitle srOnly>退会</UserPageTitle>
      <Withdraw />
    </>
  ),
});
