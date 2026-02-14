// 招待コード発行者一覧（管理画面用メインコンポーネント）

import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SolidTabs, type PageTabItem } from "@/components/Navigation";
import Header from "./Header";
import Table from "./Table";
import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

// CouponTypeOptions からタブアイテムを生成
const couponTypeTabs: PageTabItem[] = CouponTypeOptions.map((opt) => ({
  value: opt.value,
  label: opt.label,
  href: `/admin/coupons/${opt.value}`,
}));

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
        <SolidTabs tabs={couponTypeTabs} ariaLabel="クーポン種別" />
        <Header page={page} perPage={perPage} total={total} />
        <Table items={items} />
      </Stack>
    </Section>
  );
}
