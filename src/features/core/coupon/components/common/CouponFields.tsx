// src/features/coupon/components/common/CouponFields.tsx

"use client";

import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import type {
  FieldGroup,
  InlineFieldGroup,
  InsertFieldsMap,
} from "@/components/Form/FieldRenderer/types";
import { Button } from "@/components/Form/Button";
import { Shuffle } from "lucide-react";
import domainConfig from "@/features/core/coupon/domain.json";
import { generateCouponCode } from "@/features/core/coupon/utils/generateCode";

export type CouponFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
  /** フィールドのパッチ（上書き・追加） */
  fieldPatches?: FieldConfig[];
  /** フィールド挿入（指定フィールドの前に追加） */
  insertBefore?: InsertFieldsMap;
  /** フィールド挿入（指定フィールドの後に追加） */
  insertAfter?: InsertFieldsMap;
  /** フィールドグループ定義（上書き用） */
  fieldGroups?: FieldGroup[];
  /** インラインフィールドグループ定義 */
  inlineGroups?: InlineFieldGroup[];
  /** 全フィールドの前に挿入するUI */
  beforeAll?: ReactNode;
  /** 全フィールドの後に挿入するUI */
  afterAll?: ReactNode;
  /** 特定フィールドの前に挿入するUI */
  beforeField?: Partial<Record<string, ReactNode>>;
  /** 特定フィールドの後に挿入するUI */
  afterField?: Partial<Record<string, ReactNode>>;
};

export function CouponFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
  fieldPatches,
  insertBefore: insertBeforeProp,
  insertAfter,
  fieldGroups,
  inlineGroups,
  beforeAll,
  afterAll,
  beforeField,
  afterField,
}: CouponFieldsProps<TFieldValues>) {
  const handleGenerateCode = () => {
    const code = generateCouponCode();
    methods.setValue("code" as any, code);
  };

  // デフォルトの自動生成ボタン
  const codeGenerateButton = (
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
  );

  // afterFieldをマージ（外部から渡されたものがあれば優先）
  const mergedAfterField = {
    code: codeGenerateButton,
    ...afterField,
  };

  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      fieldPatches={fieldPatches}
      insertBefore={insertBeforeProp}
      insertAfter={insertAfter}
      fieldGroups={fieldGroups ?? (domainConfig.fieldGroups as FieldGroup[] | undefined)}
      inlineGroups={inlineGroups}
      onMediaStateChange={onMediaStateChange}
      beforeAll={beforeAll}
      afterAll={afterAll}
      beforeField={beforeField}
      afterField={mergedAfterField}
    />
  );
}
