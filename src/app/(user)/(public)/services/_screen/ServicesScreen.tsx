// src/app/(user)/(public)/services/_screen/ServicesScreen.tsx
// /services(サービス概要のサンプル)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public。静的な文言だけ)。ログイン状態に関わらず表示される公開ページ。

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Para } from "@/components/TextBlocks/Para";
import { createScreen } from "@/wiring/screen";

import { loadServicesScreen } from "./loader";

export const { Screen: ServicesScreen, generateMetadata } = createScreen({
  load: loadServicesScreen,
  render: () => (
    <UserPage>
      <UserPageTitle>サービス概要</UserPageTitle>
      <Para>このページはログイン状態に関わらずアクセス可能なサービス概要ページのサンプルです。</Para>
    </UserPage>
  ),
});
