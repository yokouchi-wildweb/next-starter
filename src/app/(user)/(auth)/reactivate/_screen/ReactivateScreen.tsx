// src/app/(user)/(auth)/reactivate/_screen/ReactivateScreen.tsx
// /reactivate の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// 機能フラグ・ログイン・status の遷移制御は loader、復帰操作はセクションコンテナ Reactivate。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { Reactivate } from "@/features/core/user/components/Reactivate";

import { loadReactivateScreen } from "./loader";

export async function ReactivateScreen() {
  await loadReactivateScreen();

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>アカウントの復帰</UserPageTitle>
        <Reactivate />
      </Flex>
    </UserPage>
  );
}
