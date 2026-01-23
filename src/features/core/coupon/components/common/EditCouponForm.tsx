// src/features/coupon/components/common/EditCouponForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CouponUpdateSchema } from "@/features/core/coupon/entities/schema";
import type { CouponUpdateFields } from "@/features/core/coupon/entities/form";
import type { Coupon } from "@/features/core/coupon/entities";
import { useUpdateCoupon } from "@/features/core/coupon/hooks/useUpdateCoupon";
import { CouponForm } from "./CouponForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/core/coupon/domain.json";

type Props = {
  coupon: Coupon;
  redirectPath?: string;
};

export default function EditCouponForm({ coupon, redirectPath = "/" }: Props) {
  const methods = useForm<CouponUpdateFields>({
    resolver: zodResolver(CouponUpdateSchema) as Resolver<CouponUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, coupon) as CouponUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateCoupon();
  useLoadingToast(isMutating, "更新中です…");

  const submit = async (data: CouponUpdateFields) => {
    try {
      await trigger({ id: coupon.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <CouponForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      onCancel={() => router.push(redirectPath)}
      fieldPatches={[
        { name: "code", disabled: true },
        { name: "type", disabled: true },
      ]}
      afterField={{ code: null }}
    />
  );
}
