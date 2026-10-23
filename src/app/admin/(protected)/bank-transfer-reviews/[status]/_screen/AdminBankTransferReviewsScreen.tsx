// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/AdminBankTransferReviewsScreen.tsx
// /admin/bank-transfer-reviews/[status] の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// status タブは URL 遷移で切り替える(StatusTabs)。部品はこの _screen/ に置いてある(BankTransferReviewListPanel ほか)。

import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";

import { BankTransferReviewListPanel } from "./BankTransferReviewListPanel";
import { loadAdminBankTransferReviewsScreen, type AdminBankTransferReviewsScreenParams } from "./loader";

export const metadata = {
  title: "銀行振込レビュー",
};

export async function AdminBankTransferReviewsScreen(props: ScreenProps<AdminBankTransferReviewsScreenParams>) {
  const { status } = await loadAdminBankTransferReviewsScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">銀行振込レビュー</PageTitle>
      <Section>
        <BankTransferReviewListPanel status={status} />
      </Section>
    </AdminPage>
  );
}
