// src/app/(user)/(auth)/forgot-password/_screen/ForgotPasswordScreen.tsx
// /forgot-password の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public。サーバー側の取得も遷移制御も無い。送信はセクションコンテナ ForgotPassword が hook で行う)。

import type { ScreenProps } from "@/lib/screens/types";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { ForgotPassword } from "@/features/core/auth/components/ForgotPassword";

import { loadForgotPasswordScreen } from "./loader";

export async function ForgotPasswordScreen(props: ScreenProps) {
  await loadForgotPasswordScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>パスワードをリセット</UserPageTitle>
        <ForgotPassword />
      </Flex>
    </UserPage>
  );
}
