// src/features/coupon/components/AdminCouponEdit/index.tsx

import { Suspense } from "react";
import EditCouponForm from "../common/EditCouponForm";
import type { Coupon } from "@/features/core/coupon/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminCouponEditProps = {
  coupon: Coupon;
  redirectPath?: string;
};

export default function AdminCouponEdit({ coupon, redirectPath }: AdminCouponEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditCouponForm coupon={coupon} redirectPath={redirectPath} />
    </Suspense>
  );
}
