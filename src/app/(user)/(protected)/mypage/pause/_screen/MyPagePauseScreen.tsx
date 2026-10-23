// src/app/(user)/(protected)/mypage/pause/_screen/MyPagePauseScreen.tsx
// /mypage/pause の既定画面。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md。mypage 配下は layout が UserPage を巻くので fragment を返す

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Pause } from "@/features/core/user/components/Pause";

import { loadMyPagePauseScreen } from "./loader";

export async function MyPagePauseScreen() {
  await loadMyPagePauseScreen();

  return (
    <>
      <UserPageTitle srOnly>休会</UserPageTitle>
      <Pause />
    </>
  );
}
