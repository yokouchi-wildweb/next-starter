// src/components/Form/Controlled/DatetimeInput.tsx

import { Input } from "src/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";
import { CalendarClock } from "lucide-react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useMemo, useRef } from "react";

type DatetimeLike = string | Date | number | Dayjs | null | undefined;

const formatDatetimeValue = (value: DatetimeLike): string => {
  if (value == null) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const parsed = dayjs(trimmed);
    return parsed.isValid() ? parsed.format("YYYY-MM-DDTHH:mm") : "";
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.format("YYYY-MM-DDTHH:mm") : "";
};

export const DatetimeInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
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

  const formattedValue = useMemo(
    () => formatDatetimeValue(value as DatetimeLike),
    [value],
  );

  const handleChange = (rawValue: string) => {
    if (!rawValue) {
      onChange(null);
      return;
    }

    const parsed = dayjs(rawValue);
    if (parsed.isValid()) {
      onChange(parsed.toDate());
      return;
    }

    onChange(null);
  };

  return (
    <div className="relative flex h-9 items-center">
      <Input
        ref={(el) => {
          inputRef.current = el;
          fieldRef(el);
        }}
        type="datetime-local"
        className="pr-8"
        name={name}
        onBlur={onBlur}
        {...rest}
        value={formattedValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={openPicker}
        onClick={openPicker}
      />
      <CalendarClock className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
};
