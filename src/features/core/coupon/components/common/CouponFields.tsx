// src/features/coupon/components/common/CouponFields.tsx

"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import type { FieldGroup } from "@/components/Form/FieldRenderer";
import { Button } from "@/components/Form/Button";
import domainConfig from "@/features/core/coupon/domain.json";
import { generateCouponCode } from "@/features/core/coupon/utils/generateCode";
import { Shuffle } from "lucide-react";

export type CouponFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
};

export function CouponFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: CouponFieldsProps<TFieldValues>) {
  const handleGenerateCode = () => {
    const code = generateCouponCode();
    methods.setValue("code" as any, code);
  };

  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      fieldGroups={(domainConfig.fieldGroups ?? []) as FieldGroup[]}
      onMediaStateChange={onMediaStateChange}
      afterField={{
        code: (
          <div className="self-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateCode}
            >
              <Shuffle className="size-4" />
              自動生成
            </Button>
          </div>
        ),
      } as any}
    />
  );
}
