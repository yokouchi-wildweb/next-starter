// src/app/admin/insane/_screen/InsaneDashboardScreen.tsx
// /admin/insane の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い。管理者判定は insane/layout.tsx)。

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import { SecTitle } from "@/components/TextBlocks";

export function InsaneDashboardScreen() {
  return (
    <AdminPage>
      <SecTitle>インセインモード</SecTitle>
    </AdminPage>
  );
}
