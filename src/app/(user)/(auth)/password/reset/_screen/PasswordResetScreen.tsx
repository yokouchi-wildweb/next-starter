// src/app/(user)/(auth)/password/reset/_screen/PasswordResetScreen.tsx
// /password/reset の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// oobCode の取り出しは loader、検証と再設定はセクションコンテナ ResetPassword。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { ResetPassword } from "@/features/core/auth/components/ResetPassword";
import type { ScreenProps } from "@/lib/screens/types";

import { loadPasswordResetScreen, type PasswordResetScreenSearchParams } from "./loader";

export async function PasswordResetScreen(
  props: ScreenProps<Record<string, never>, PasswordResetScreenSearchParams>,
) {
  const { oobCode } = await loadPasswordResetScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>パスワードを再設定</UserPageTitle>
        <ResetPassword oobCode={oobCode} />
      </Flex>
    </UserPage>
  );
}
