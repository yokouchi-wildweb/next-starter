// 招待コード発行者一覧（管理画面用メインコンポーネント）

import { buildCouponAdminSectionTabs } from "@/features/core/coupon/lib/adminSectionTabs";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SolidTabs } from "@/components/Navigation";
import Header from "./Header";
import Table from "./Table";
import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

// セクションタブ（core 3 タブ + downstream 登録分）
const couponSectionTabs = buildCouponAdminSectionTabs();

export type AdminInviteListProps = {
  items: InviteCodeWithCount[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminInviteList({
  items,
  page,
  perPage,
  total,
}: AdminInviteListProps) {
  return (
    <Section>
      <Stack space={6}>
        <SolidTabs tabs={couponSectionTabs} ariaLabel="クーポン種別" />
        <Header page={page} perPage={perPage} total={total} />
        <Table items={items} />
      </Stack>
    </Section>
  );
}
