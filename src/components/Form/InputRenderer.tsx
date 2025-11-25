// src/components/Form/InputRenderer.tsx

import { FieldType, Options } from "@/types/form";
import { CheckGroupInput, RadioGroupInput, SelectInput, MultiSelectInput } from "src/components/Form/Manual";
import { DateInput, TextInput, SwitchInput, TimeInput } from "@/components/Form/Controlled";
import type { ComponentProps, HTMLAttributes } from "react";

function InputRenderer(type: FieldType, field: any, options?: Options[], rest?: HTMLAttributes<HTMLElement>) {
  switch (type) {
    case "radio":
      return (
        <RadioGroupInput
          field={field}
          options={options ?? []}
          {...(rest as Partial<ComponentProps<typeof RadioGroupInput>>)}
        />
      );

    case "checkbox":
      return <CheckGroupInput field={field} options={options ?? []} {...rest} />;

    case "select":
      return <SelectInput field={field} options={options ?? []} {...rest} placeholder="選択してください" />;

    case "multi-select":
      return (
        <MultiSelectInput
          field={field}
          options={options ?? []}
          {...(rest as Partial<ComponentProps<typeof MultiSelectInput>>)}
        />
      );

    case "switch":
      return <SwitchInput field={field} {...(rest as any)} />;

    case "date":
      return <DateInput field={field} {...rest} />;

    case "time":
      return <TimeInput field={field} {...rest} />;

    case "text":
    default:
      return <TextInput field={field} {...rest} />;
  }
}
