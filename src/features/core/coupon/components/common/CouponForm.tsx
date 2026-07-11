// src/features/coupon/components/common/CouponForm.tsx

"use client";

import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import type { FieldConfig } from "@/components/Form/Field";
import type {
  FieldGroup,
  GroupContentMap,
  InlineFieldGroup,
  InsertFieldsMap,
} from "@/components/Form/FieldRenderer/types";
import { CouponFields } from "./CouponFields";

export type CouponFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  onCancel?: () => void;
  /** フィールドのパッチ（上書き・追加） */
  fieldPatches?: (Partial<FieldConfig> & { name: string })[];
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
  /** 特定グループの先頭に挿入するUI（キー: FieldGroup.key） */
  beforeGroup?: GroupContentMap;
  /** 特定グループの末尾に挿入するUI（キー: FieldGroup.key） */
  afterGroup?: GroupContentMap;
};

export function CouponForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  onCancel,
  fieldPatches,
  insertBefore,
  insertAfter,
  fieldGroups,
  inlineGroups,
  beforeAll,
  afterAll,
  beforeField,
  afterField,
  beforeGroup,
  afterGroup,
}: CouponFormProps<TFieldValues>) {
  return (
    <AppForm
      methods={methods}
      onSubmit={onSubmitAction}
      pending={isMutating}
      fieldSpace={6}
    >
      <CouponFields<TFieldValues>
        methods={methods}
        fieldPatches={fieldPatches}
        insertBefore={insertBefore}
        insertAfter={insertAfter}
        fieldGroups={fieldGroups}
        inlineGroups={inlineGroups}
        beforeAll={beforeAll}
        afterAll={afterAll}
        beforeField={beforeField}
        afterField={afterField}
        beforeGroup={beforeGroup}
        afterGroup={afterGroup}
      />
      <div className="flex justify-center gap-3">
        <Button type="submit" variant="default">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
        ) : null}
      </div>
    </AppForm>
  );
}
