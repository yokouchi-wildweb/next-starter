// src/features/coupon/components/AdminCouponList/index.tsx

import type { Coupon } from "@/features/core/coupon/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

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
      <Header page={page} perPage={perPage} total={total} />
      <Table coupons={coupons} />
    </Section>
  );
}
