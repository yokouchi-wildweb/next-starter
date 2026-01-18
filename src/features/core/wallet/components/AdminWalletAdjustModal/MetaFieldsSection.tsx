// src/features/core/wallet/components/AdminWalletAdjustModal/MetaFieldsSection.tsx

"use client";

import type { Control } from "react-hook-form";

import { FieldItem } from "@/components/Form";
import { TextInput, Textarea } from "@/components/Form/Controlled";

import type { WalletType } from "@/config/app/currency.config";
import type { CurrencyMetaFieldConfig } from "@/features/core/wallet/types/currency";
import { getMetaFieldsByWalletType } from "@/features/core/wallet/utils/currency";
import type { WalletAdjustFormValues } from "./formEntities";

type MetaFieldsSectionProps = {
  control: Control<WalletAdjustFormValues>;
  walletType: WalletType;
};

export function MetaFieldsSection({ control, walletType }: MetaFieldsSectionProps) {
  const metaFields = getMetaFieldsByWalletType(walletType);

  return metaFields.map((field) => (
    <FieldItem
      key={field.name}
      control={control}
      name={field.name as keyof WalletAdjustFormValues}
      label={field.label}
      description={resolveDescription(field)}
      renderInput={(controllerField) =>
        field.formInput === "textarea" ? (
          <Textarea
            field={controllerField}
            placeholder={field.placeholder}
            rows={field.rows ?? 2}
          />
        ) : (
          <TextInput
            field={controllerField}
            placeholder={field.placeholder}
          />
        )
      }
    />
  ));
}

function resolveDescription(field: CurrencyMetaFieldConfig) {
  if (!field.description || field.description.trim().length === 0) {
    return undefined;
  }
  return {
    text: field.description,
    tone: "muted" as const,
    size: "xs" as const,
  };
}
