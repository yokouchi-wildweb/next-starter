// src/features/coupon/components/AdminCouponList/index.tsx

import type { Coupon } from "@/features/core/coupon/entities";
import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SolidTabs, type PageTabItem } from "@/components/Navigation";

// CouponTypeOptions からタブアイテムを生成
const couponTypeTabs: PageTabItem[] = CouponTypeOptions.map(opt => ({
  value: opt.value,
  label: opt.label,
  href: `/admin/coupons/${opt.value}`,
}));

export type AdminCouponListProps = {
  coupons: Coupon[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminCouponList({
  coupons,
  page,
  perPage,
  total,
}: AdminCouponListProps) {
  return (
    <Section>
      <Stack space={6}>
        <SolidTabs tabs={couponTypeTabs} ariaLabel="クーポン種別" />
        <Header page={page} perPage={perPage} total={total} />
        <Table coupons={coupons} />
      </Stack>
    </Section>
  );
}
