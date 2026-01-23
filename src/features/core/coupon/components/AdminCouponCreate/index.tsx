// src/features/coupon/components/AdminCouponCreate/index.tsx

import { Suspense } from "react";
import CreateCouponForm from "../common/CreateCouponForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminCouponCreateProps = {
  redirectPath?: string;
};

export default function AdminCouponCreate({ redirectPath }: AdminCouponCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateCouponForm redirectPath={redirectPath} />
    </Suspense>
  );
}
