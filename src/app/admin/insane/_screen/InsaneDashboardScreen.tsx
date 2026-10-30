// src/app/admin/insane/_screen/InsaneDashboardScreen.tsx
// /admin/insane の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い。範囲は insane/guard.ts)。

import type { ScreenProps } from "@/lib/screens/types";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { SecTitle } from "@/components/TextBlocks";

import { loadInsaneDashboardScreen } from "./loader";

export async function InsaneDashboardScreen(props: ScreenProps) {
  await loadInsaneDashboardScreen(props);

  return (
    <AdminPage>
      <SecTitle>インセインモード</SecTitle>
    </AdminPage>
  );
}
