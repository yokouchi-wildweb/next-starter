// src/app/admin/(protected)/coupons/affiliate/_screen/AdminCouponAffiliateListScreen.tsx
// /admin/coupons/affiliate の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md
//
// loader は無い(準備中の案内だけ)。

import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Para } from "@/components/TextBlocks/Para";
import { Construction } from "lucide-react";

import { CouponSectionTabs } from "../../_screen/CouponSectionTabs";

export const metadata = {
  title: "クーポン一覧（アフィリエイト）",
};

export function AdminCouponAffiliateListScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">クーポン管理</PageTitle>
      <CouponSectionTabs placement="header" />
      <Section>
        <Stack space={6}>
          <ListTop title="発行済みのアフィリエイトクーポン" />
          <Para tone="muted">
            インフルエンサーにコードを配布し、プロモーションを行うことができます。
          </Para>
          <Stack
            appearance="surface"
            padding="lg"
            space={4}
            className="items-center justify-center py-12"
          >
            <Construction className="size-12 text-muted-foreground" />
            <Para tone="muted" className="text-center">
              このページは準備中です
            </Para>
          </Stack>
        </Stack>
      </Section>
    </AdminPage>
  );
}
