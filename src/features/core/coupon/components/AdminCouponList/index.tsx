// src/features/coupon/components/AdminCouponList/index.tsx

import type { Coupon } from "@/features/core/coupon/entities";
import { buildCouponAdminSectionTabs } from "@/features/core/coupon/lib/adminSectionTabs";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SolidTabs } from "@/components/Navigation";

// セクションタブ（core 3 タブ + downstream 登録分）
const couponSectionTabs = buildCouponAdminSectionTabs();

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
        <SolidTabs tabs={couponSectionTabs} ariaLabel="クーポン種別" />
        <Header page={page} perPage={perPage} total={total} />
        <Table coupons={coupons} />
      </Stack>
    </Section>
  );
}
