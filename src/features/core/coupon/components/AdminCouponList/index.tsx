// src/features/coupon/components/AdminCouponList/index.tsx

// セクションタブ（official / affiliate / invite ...）はここでは描画しない。
// 配置はページの関心事なので page.tsx が CouponSectionTabs を置く
// （src/app/admin/(protected)/coupons/_components/CouponSectionTabs.tsx）。

import type { Coupon } from "@/features/core/coupon/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";

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
        <Header page={page} perPage={perPage} total={total} />
        <Table coupons={coupons} />
      </Stack>
    </Section>
  );
}
