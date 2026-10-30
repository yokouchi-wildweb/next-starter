// src/app/(user)/(auth)/demo-login/_screen/DemoLoginScreen.tsx
// /demo-login(デモモードの入口)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (部品の import は ../_screen/DemoLoginSection に直す)。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public)。デモモード無効時の 404 は Proxy 層(demoModeProxy)が担う。
// ログイン操作は client 部品 DemoLoginSection が hook で行う。

import type { ScreenProps } from "@/lib/screens/types";
import { HideBottomNav } from "@/components/AppFrames/User/controls/BottomNavControl";
import { HideFooter } from "@/components/AppFrames/User/controls/FooterControl";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Flex } from "@/components/Layout/Flex";

import { DemoLoginSection } from "./DemoLoginSection";

import { loadDemoLoginScreen } from "./loader";

/** デモログイン後の遷移先 */
const REDIRECT_AFTER_LOGIN = "/";

export async function DemoLoginScreen(props: ScreenProps) {
  await loadDemoLoginScreen(props);

  return (
    <>
      <HideFooter />
      <HideBottomNav />
      <UserPage>
        <UserPageTitle srOnly>デモモード</UserPageTitle>
        <Flex direction="column" align="center" justify="center" className="min-h-[60vh]">
          <DemoLoginSection redirectTo={REDIRECT_AFTER_LOGIN} />
        </Flex>
      </UserPage>
    </>
  );
}
