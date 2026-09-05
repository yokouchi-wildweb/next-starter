export const dynamic = "force-dynamic";

import { buildCouponAdminSectionTabs } from "@/features/core/coupon/lib/adminSectionTabs";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SolidTabs } from "@/components/Navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Para } from "@/components/TextBlocks/Para";
import { Construction } from "lucide-react";

export const metadata = {
  title: "クーポン一覧（アフィリエイト）",
};

// セクションタブ（core 3 タブ + downstream 登録分）
const couponSectionTabs = buildCouponAdminSectionTabs();

export default async function AdminCouponAffiliateListPage() {
  return (
    <AdminPage>
      <PageTitle placement="header">クーポン管理</PageTitle>
      <Section>
        <Stack space={6}>
          <SolidTabs tabs={couponSectionTabs} ariaLabel="クーポン種別" />
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
