// src/components/Form/manual/RadioGroupInput.tsx

import type { ComponentProps } from "react";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/Shadcn/radio-group";
import { Options } from "@/types/form";

type Props = {
  field: {
    value?: string;
    onChange: (value: string) => void;
  };
  options: Options[];
} & ComponentProps<typeof RadioGroup>;

export function RadioGroupInput({ field, options, ...rest }: Props) {
  return (
    <RadioGroup onValueChange={field.onChange} value={field.value} defaultValue={field.value} {...rest}>
      {options.map((op, index) => {
        const optionId = `${rest.name ?? "radio"}-${op.value}-${index}`;

        return (
          <div key={optionId} className="flex items-center gap-2">
            <RadioGroupItem id={optionId} value={op.value} />
            <Label htmlFor={optionId} className="cursor-pointer">{op.label}</Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
