// src/app/admin/insane/truncate/page.tsx

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import { SecTitle } from "@/components/TextBlocks";

import { TruncateDomainForm } from "./TruncateDomainForm";

export default function TruncatePage() {
  return (
    <AdminPage>
      <SecTitle>ドメイン全削除（TRUNCATE）</SecTitle>
      <p className="text-sm text-muted-foreground mb-6">
        選択したドメインの全データを物理削除します。この操作は取り消せません。
      </p>
      <TruncateDomainForm />
    </AdminPage>
  );
}
