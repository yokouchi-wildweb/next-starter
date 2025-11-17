// src/components/Form/Controlled/TimeInput.tsx

import { Input } from "src/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";
import { Clock } from "lucide-react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useMemo, useRef } from "react";

type TimeLike = string | Date | number | Dayjs | null | undefined;

function formatTimeValue(value: TimeLike): string {
  if (value == null) return "";

  if (typeof value === "string") {
    const isoMatch = value.match(/[T\s](\d{2}:\d{2})/);
    if (isoMatch) return isoMatch[1];

    const hhmmMatch = value.match(/^(\d{2}:\d{2})/);
    if (hhmmMatch) return hhmmMatch[1];

    const hhmmssMatch = value.match(/^(\d{2}:\d{2}):\d{2}(?:\.\d+)?$/);
    if (hhmmssMatch) return hhmmssMatch[1];

    return "";
  }

  if (typeof value === "number") {
    return dayjs(value).format("HH:mm");
  }

  if (dayjs.isDayjs(value)) {
    return value.format("HH:mm");
  }

  if (value instanceof Date) {
    return dayjs(value).format("HH:mm");
  }

  return "";
}

export const TimeInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
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

  const formattedValue = useMemo(() => formatTimeValue(value as TimeLike), [value]);

  return (
    <div className="relative flex h-9 items-center">
      <Input
        ref={(el) => {
          inputRef.current = el;
          fieldRef(el);
        }}
        type="time"
        className="pr-8"
        name={name}
        onBlur={onBlur}
        {...rest}
        value={formattedValue}
        onChange={(e) => onChange(e.target.value)}
        onFocus={openPicker}
        onClick={openPicker}
      />
      <Clock className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
};
