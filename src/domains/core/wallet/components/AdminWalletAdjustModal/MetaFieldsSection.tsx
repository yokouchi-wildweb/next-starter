// src/domains/core/wallet/components/AdminWalletAdjustModal/MetaFieldsSection.tsx

"use client";

import type { Control } from "react-hook-form";

import { ControlledField } from "@/lib/formSuite";
import { ControlledTextInput, ControlledTextarea } from "@/lib/formSuite";

import type { WalletType } from "@/domains/wallet/config";
import type { CurrencyMetaFieldConfig } from "@/domains/core/wallet/types/currency";
import { getMetaFieldsByWalletType } from "@/domains/core/wallet/utils/currency";
import type { WalletAdjustFormValues } from "./formEntities";

type MetaFieldsSectionProps = {
  control: Control<WalletAdjustFormValues>;
  walletType: WalletType;
};

export function MetaFieldsSection({ control, walletType }: MetaFieldsSectionProps) {
  const metaFields = getMetaFieldsByWalletType(walletType);

  return metaFields.map((field) => (
    <ControlledField
      key={field.name}
      control={control}
      name={field.name as keyof WalletAdjustFormValues}
      label={field.label}
      description={resolveDescription(field)}
      renderInput={(controllerField) =>
        field.formInput === "textarea" ? (
          <ControlledTextarea
            field={controllerField}
            placeholder={field.placeholder}
            rows={field.rows ?? 2}
          />
        ) : (
          <ControlledTextInput
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
