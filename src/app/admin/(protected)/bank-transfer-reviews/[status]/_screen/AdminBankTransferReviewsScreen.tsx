// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/AdminBankTransferReviewsScreen.tsx
// /admin/bank-transfer-reviews/[status] の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// status タブは URL 遷移で切り替える(StatusTabs)。部品はこの _screen/ に置いてある(BankTransferReviewListPanel ほか)。

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import { createScreen } from "@/wiring/screen";

import { BankTransferReviewListPanel } from "./BankTransferReviewListPanel";
import { BankTransferStatusTabs } from "./StatusTabs";
import { loadAdminBankTransferReviewsScreen } from "./loader";

export const { Screen: AdminBankTransferReviewsScreen, generateMetadata } = createScreen({
  load: loadAdminBankTransferReviewsScreen,
  render: ({ status }) => (
    <AdminPage title="銀行振込レビュー" center={<BankTransferStatusTabs />}>
      <Section>
        <BankTransferReviewListPanel status={status} />
      </Section>
    </AdminPage>
  ),
  metadata: {
    title: "銀行振込レビュー",
  },
});
