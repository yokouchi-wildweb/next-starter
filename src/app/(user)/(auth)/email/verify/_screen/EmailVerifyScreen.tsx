// src/app/(user)/(auth)/email/verify/_screen/EmailVerifyScreen.tsx
// /email/verify(メールアドレス変更リンクの着地)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (部品の import は ../_screen/EmailChangeVerification に直す)。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public)。oobCode の読み取り・ログイン要求・変更の実行は client 部品 EmailChangeVerification が hook で行う
// (ログイン後に同じ URL へ戻る必要があるため pathname と合わせて client で扱う)。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";

import { EmailChangeVerification } from "./EmailChangeVerification";

import { loadEmailVerifyScreen } from "./loader";

export async function EmailVerifyScreen(props: ScreenProps) {
  await loadEmailVerifyScreen(props);

  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>メールアドレス変更</UserPageTitle>
      <EmailChangeVerification />
    </UserPage>
  );
}
