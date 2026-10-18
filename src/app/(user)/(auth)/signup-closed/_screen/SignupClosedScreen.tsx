// src/app/(user)/(auth)/signup-closed/_screen/SignupClosedScreen.tsx
// /signup-closed(新規登録の受付停止中)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(静的な案内のみ。ここへの誘導は登録フロー側が行う)。

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

export function SignupClosedScreen() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>会員登録 受付停止中</UserPageTitle>
      <Para>新規会員登録の受付を停止しております。</Para>
      <Stack space={3} className="mt-6">
        <LinkButton href="/login" variant="default">
          ログインはこちら
        </LinkButton>
        <LinkButton href="/" variant="outline">
          トップページへ戻る
        </LinkButton>
      </Stack>
    </UserPage>
  );
}
