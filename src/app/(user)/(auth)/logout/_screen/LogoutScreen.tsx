// src/app/(user)/(auth)/logout/_screen/LogoutScreen.tsx
// /logout の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (loader の import は ../_screen/loader に、部品の import は ../_screen/LogoutSection に直す)。手順: src/lib/screens/README.md
//
// 遷移先の解釈は loader、ログアウトの実行は client 部品 LogoutSection。

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import type { ScreenProps } from "@/lib/screens/types";

import { loadLogoutScreen, type LogoutScreenSearchParams } from "./loader";
import { LogoutSection } from "./LogoutSection";

export async function LogoutScreen(props: ScreenProps<Record<string, never>, LogoutScreenSearchParams>) {
  const { redirectTo } = await loadLogoutScreen(props);

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <LogoutSection redirectTo={redirectTo} />
      </Flex>
    </UserPage>
  );
}
