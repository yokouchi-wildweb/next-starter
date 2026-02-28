import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
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

type DateLike = string | number | Date | null | undefined;

type BaseProps = Omit<InputProps, "type" | "value" | "defaultValue" | "onChange">;

export type DateInputProps = BaseProps & {
  value?: DateLike;
  defaultValue?: DateLike;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

const formatDateValue = (value: DateLike): string => {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = dayjs(trimmed);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>((props, forwardedRef) => {
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
        // showPicker はユーザー操作でないと失敗するため握りつぶす
      }
    }
  }, []);

  const hasValueProp = Object.prototype.hasOwnProperty.call(props, "value");
  const hasDefaultValueProp = Object.prototype.hasOwnProperty.call(props, "defaultValue");

  const resolvedValue = useMemo(() => {
    if (!hasValueProp) return undefined;
    return formatDateValue(value);
  }, [hasValueProp, value]);

  const resolvedDefaultValue = useMemo(() => {
    if (hasValueProp || !hasDefaultValueProp) {
      return undefined;
    }
    return formatDateValue(defaultValue);
  }, [defaultValue, hasDefaultValueProp, hasValueProp]);

  const inputValueProps = hasValueProp
    ? { value: resolvedValue ?? "" }
    : hasDefaultValueProp
      ? { defaultValue: resolvedDefaultValue ?? "" }
      : {};

  return (
    <div className={cn("relative flex h-fit items-center", className, containerClassName)}>
      <Input
        {...rest}
        ref={assignRef}
        type="date"
        className="pr-8"
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
      <CalendarIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
});

DateInput.displayName = "DateInput";
