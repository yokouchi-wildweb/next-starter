// src/features/core/wallet/components/AdminWalletAdjustModal/MetaFieldsSection.tsx

"use client";

import type { Control } from "react-hook-form";

import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput, Textarea } from "@/components/Form/Controlled";

import { walletMetaFieldDefinitions } from "@/features/core/wallet/constants/metaFields";
import type { WalletAdjustFormValues } from "./formEntities";

type MetaFieldsSectionProps = {
  control: Control<WalletAdjustFormValues>;
};

export function MetaFieldsSection({ control }: MetaFieldsSectionProps) {
  return walletMetaFieldDefinitions.map((field) => (
    <FormFieldItem
      key={field.name}
      control={control}
      name={field.name}
      label={field.label}
      description={
        field.description
          ? {
              text: field.description,
              tone: "muted",
              size: "xs",
            }
          : undefined
      }
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
