export const dynamic = "force-dynamic";

import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SolidTabs, type PageTabItem } from "@/components/Navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Para } from "@/components/TextBlocks/Para";
import { Construction } from "lucide-react";

export const metadata = {
  title: "クーポン一覧（ユーザー招待）",
};

// CouponTypeOptions からタブアイテムを生成
const couponTypeTabs: PageTabItem[] = CouponTypeOptions.map(opt => ({
  value: opt.value,
  label: opt.label,
  href: `/admin/coupons/${opt.value}`,
}));

export default async function AdminCouponInviteListPage() {
  return (
    <AdminPage>
      <PageTitle>クーポン管理</PageTitle>
      <Section>
        <Stack space={6}>
          <SolidTabs tabs={couponTypeTabs} ariaLabel="クーポン種別" />
          <ListTop title="発行済みの招待クーポン" />
          <Para tone="muted">
            既存ユーザーによる紹介で新規ユーザーを獲得できます。
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
