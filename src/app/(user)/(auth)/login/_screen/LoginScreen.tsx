// src/app/(user)/(auth)/login/_screen/LoginScreen.tsx
// /login の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// ログイン後の遷移先とログイン済みの redirect は loader が担う。フォームはセクションコンテナ UserLogin。

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { UserLogin } from "@/features/core/auth/components/UserLogin";
import type { ScreenProps } from "@/lib/screens/types";

import { loadLoginScreen, type LoginScreenSearchParams } from "./loader";

export async function LoginScreen(props: ScreenProps<Record<string, never>, LoginScreenSearchParams>) {
  const { redirectTo } = await loadLoginScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>ログイン</UserPageTitle>
        <UserLogin redirectTo={redirectTo} />
      </Flex>
    </UserPage>
  );
}
