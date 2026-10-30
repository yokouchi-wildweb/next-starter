// src/app/(user)/(auth)/signup/complete/_screen/SignupCompleteScreen.tsx
// /signup/complete(本登録完了)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (部品の import は ../_screen/SignupCompleteSection に直す)。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public)。/signup/register からの正当な遷移かどうかは referer ベースの client 側ガード
// (useTransitionGuard)で判定するため、サーバー側の遷移制御は持たない。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPage } from "@/app/(user)/_layout/UserPage";

import { SignupCompleteSection } from "./SignupCompleteSection";

import { loadSignupCompleteScreen } from "./loader";

export async function SignupCompleteScreen(props: ScreenProps) {
  await loadSignupCompleteScreen(props);

  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <SignupCompleteSection />
    </UserPage>
  );
}
