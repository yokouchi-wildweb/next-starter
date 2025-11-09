// src/components/Form/DateInput.tsx

import { Input } from "@/components/Form/manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";
import { CalendarIcon } from "lucide-react";
import dayjs from "dayjs";
import { useRef } from "react";

export const DateInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  field,
  ...rest
}: ControlledInputProps<TFieldValues, TName>) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current as HTMLInputElement | null;
    if (el && typeof (el as any).showPicker === "function") {
      (el as any).showPicker();
    }
  };

  const { name, onBlur, onChange, value, ref: fieldRef } = field;

  return (
    <div className="relative">
      <Input
        ref={(el) => {
          inputRef.current = el;
          fieldRef(el);
        }}
        type="date"
        className="pr-8"
        name={name}
        onBlur={onBlur}
        {...rest}
        value={value ? dayjs(value).format("YYYY-MM-DD") : ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={openPicker}
        onClick={openPicker}
      />
      <CalendarIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
};
