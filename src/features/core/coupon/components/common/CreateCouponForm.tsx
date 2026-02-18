// src/features/coupon/components/common/CreateCouponForm.tsx

"use client";

import { useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CouponCreateSchema } from "@/features/core/coupon/entities/schema";
import { CouponCreateFields } from "@/features/core/coupon/entities/form";
import { useCreateCoupon } from "@/features/core/coupon/hooks/useCreateCoupon";
import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import { useCouponCategories } from "@/features/core/coupon/hooks/useCouponCategories";
import { CouponForm } from "./CouponForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field/types";
import type { FieldGroup } from "@/components/Form/FieldRenderer/types";
import domainConfig from "@/features/core/coupon/domain.json";

type Props = {
  redirectPath?: string;
};

// 管理画面では公式プロモーションのみ選択可能
const officialOnlyOptions = CouponTypeOptions.filter(opt => opt.value === "official");

export default function CreateCouponForm({ redirectPath = "/" }: Props) {
  const { categories, categoryInfoList } = useCouponCategories();

  const methods = useForm<CouponCreateFields>({
    resolver: zodResolver(CouponCreateSchema) as Resolver<CouponCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as CouponCreateFields,
  });

  const selectedCategory = methods.watch("category" as any) as string | undefined;

  // 選択中カテゴリの settingsFields を settings.{name} にプレフィックス変換
  const settingsFields = useMemo<FieldConfig[]>(() => {
    if (!selectedCategory) return [];
    const info = categoryInfoList.find(c => c.value === selectedCategory);
    if (!info?.settingsFields?.length) return [];
    return info.settingsFields.map(f => ({
      ...f,
      name: `settings.${f.name}`,
    }));
  }, [selectedCategory, categoryInfoList]);

  // settingsFields がある場合、fieldGroups に動的セクションを追加
  const dynamicFieldGroups = useMemo<FieldGroup[]>(() => {
    const base = (domainConfig as any).fieldGroups as FieldGroup[];
    if (settingsFields.length === 0) return base;
    return [
      ...base,
      {
        key: "settings",
        label: "カテゴリ設定",
        fields: settingsFields.map(f => f.name),
        bgColor: "#f0fff4",
      },
    ];
  }, [settingsFields]);

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
        { name: "category", options: categories, placeholder: "カテゴリを選択" },
      ]}
      insertAfter={
        settingsFields.length > 0
          ? { __last__: settingsFields }
          : undefined
      }
      fieldGroups={dynamicFieldGroups}
    />
  );
}
