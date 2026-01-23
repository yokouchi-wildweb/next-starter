// src/features/coupon/components/common/CreateCouponForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CouponCreateSchema } from "@/features/core/coupon/entities/schema";
import { CouponCreateFields } from "@/features/core/coupon/entities/form";
import { useCreateCoupon } from "@/features/core/coupon/hooks/useCreateCoupon";
import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import { CouponForm } from "./CouponForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/core/coupon/domain.json";

type Props = {
  redirectPath?: string;
};

// 管理画面では公式プロモーションのみ選択可能
const officialOnlyOptions = CouponTypeOptions.filter(opt => opt.value === "official");

export default function CreateCouponForm({ redirectPath = "/" }: Props) {
  const methods = useForm<CouponCreateFields>({
    resolver: zodResolver(CouponCreateSchema) as Resolver<CouponCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as CouponCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateCoupon();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: CouponCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <CouponForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
      fieldPatches={[
        { name: "type", options: officialOnlyOptions },
      ]}
    />
  );
}
