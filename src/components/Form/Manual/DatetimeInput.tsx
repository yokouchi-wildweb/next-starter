import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { CalendarClock } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  type ComponentProps,
  type ChangeEventHandler,
  type SyntheticEvent,
} from "react";

import { cn } from "@/lib/cn";

import { Input } from "./Input";

type InputProps = ComponentProps<typeof Input>;
type DatetimeLike = string | Date | number | Dayjs | null | undefined;

type BaseProps = Omit<InputProps, "type" | "value" | "defaultValue" | "onChange">;

export type DatetimeInputProps = BaseProps & {
  value?: DatetimeLike;
  defaultValue?: DatetimeLike;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

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

export const DatetimeInput = forwardRef<HTMLInputElement, DatetimeInputProps>(
  (props, forwardedRef) => {
    const {
      value,
      defaultValue,
      onValueChange,
      containerClassName,
      className,
    onFocus,
    onClick,
    onChange,
    ...rest
  } = props;

    const localRef = useRef<HTMLInputElement | null>(null);

    const assignRef = useCallback(
      (node: HTMLInputElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const openPicker = useCallback((event?: SyntheticEvent) => {
      if (event && !event.isTrusted) return;
      const el = localRef.current;
      if (el && typeof (el as any).showPicker === "function") {
        try {
          (el as any).showPicker();
        } catch {
          // showPicker はユーザー操作コンテキスト以外では失敗するため無視
        }
      }
    }, []);

    const hasValueProp = Object.prototype.hasOwnProperty.call(props, "value");
    const hasDefaultValueProp = Object.prototype.hasOwnProperty.call(props, "defaultValue");

    const resolvedValue = useMemo(() => {
      if (!hasValueProp) return undefined;
      return formatDatetimeValue(value);
    }, [hasValueProp, value]);

    const resolvedDefaultValue = useMemo(() => {
      if (hasValueProp || !hasDefaultValueProp) {
        return undefined;
      }
      return formatDatetimeValue(defaultValue);
    }, [defaultValue, hasDefaultValueProp, hasValueProp]);

    const inputValueProps = hasValueProp
      ? { value: resolvedValue ?? "" }
      : hasDefaultValueProp
        ? { defaultValue: resolvedDefaultValue ?? "" }
        : {};

    return (
      <div className={cn("relative flex h-fit items-center", containerClassName)}>
        <Input
        {...rest}
        ref={assignRef}
          type="datetime-local"
          className={cn("pr-8", className)}
          {...inputValueProps}
          onFocus={(event) => {
            onFocus?.(event);
            openPicker(event);
          }}
          onClick={(event) => {
            onClick?.(event);
            openPicker(event);
          }}
          onChange={(event) => {
            onChange?.(event);
            onValueChange?.(event.target.value);
          }}
        />
        <CalendarClock className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  },
);

DatetimeInput.displayName = "DatetimeInput";
