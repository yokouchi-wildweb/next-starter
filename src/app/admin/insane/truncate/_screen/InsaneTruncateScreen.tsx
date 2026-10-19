// src/app/admin/insane/truncate/_screen/InsaneTruncateScreen.tsx
// /admin/insane/truncate の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い。削除はセクションコンテナ TruncateDomainForm が行う)。

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import { Para, SecTitle } from "@/components/TextBlocks";
import { TruncateDomainForm } from "@/features/core/insane/components/TruncateDomainForm";

export function InsaneTruncateScreen() {
  return (
    <AdminPage>
      <SecTitle>ドメイン全削除（TRUNCATE）</SecTitle>
      <Para tone="muted" size="sm" className="mb-6">
        選択したドメインの全データを物理削除します。この操作は取り消せません。
      </Para>
      <TruncateDomainForm />
    </AdminPage>
  );
}
