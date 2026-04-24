// @/components/Form/Input/Manual/DateInput.tsx
//
// 日付入力コンポーネント。
// - テキスト直入力・ペースト対応（空白/スラッシュ/ドット/和文など広めに受理）
// - 右側アイコンクリックで Popover に Calendar を表示
// - 入出力契約: value は DateLike、onValueChange は "YYYY-MM-DD" または "" を返す

"use client";

import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ChangeEventHandler,
} from "react";

import { cn } from "@/lib/cn";
import { parseFlexibleDate } from "@/lib/date/parseFlexible";
import { Calendar } from "@/components/Overlays/Calendar";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "@/components/Overlays/Popover/PopoverPrimitives";

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
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = dayjs(trimmed);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : trimmed;
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
    onBlur,
    onChange,
    placeholder = "YYYY-MM-DD",
    ...rest
  } = props;

  const hasValueProp = Object.prototype.hasOwnProperty.call(props, "value");
  const hasDefaultValueProp = Object.prototype.hasOwnProperty.call(props, "defaultValue");

  const initialFormatted = useMemo(() => {
    if (hasValueProp) return formatDateValue(value);
    if (hasDefaultValueProp) return formatDateValue(defaultValue);
    return "";
  }, [hasValueProp, hasDefaultValueProp, value, defaultValue]);

  const [rawInput, setRawInput] = useState<string>(initialFormatted);
  const [isInvalid, setIsInvalid] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [prevExternalValue, setPrevExternalValue] = useState(value);
  const localRef = useRef<HTMLInputElement | null>(null);

  // 制御モードで prop value が外部から変わった時だけローカル表示を追従させる
  if (hasValueProp && value !== prevExternalValue) {
    setPrevExternalValue(value);
    setRawInput(formatDateValue(value));
    setIsInvalid(false);
  }

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

  const commit = useCallback(
    (next: string) => {
      const parsed = parseFlexibleDate(next);
      if (parsed === null) {
        // パース不能: raw を保持しつつエラー表示
        setIsInvalid(true);
        return;
      }
      setIsInvalid(false);
      setRawInput(parsed);
      onValueChange?.(parsed);
    },
    [onValueChange],
  );

  const selectedDate = useMemo(() => {
    const parsed = dayjs(rawInput, "YYYY-MM-DD", true);
    return parsed.isValid() ? parsed.toDate() : undefined;
  }, [rawInput]);

  return (
    <div className={cn("relative flex h-fit items-center", containerClassName)}>
      <Input
        {...rest}
        ref={assignRef}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        className={cn("pr-10", className)}
        value={rawInput}
        aria-invalid={isInvalid || rest["aria-invalid"]}
        onChange={(event) => {
          onChange?.(event);
          setRawInput(event.target.value);
          if (isInvalid) setIsInvalid(false);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          commit(event.target.value);
        }}
      />
      <PopoverRoot open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="カレンダーを開く"
            tabIndex={-1}
            disabled={rest.disabled || rest.readOnly}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarIcon className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent size="auto" className="p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (!date) {
                setRawInput("");
                setIsInvalid(false);
                onValueChange?.("");
                return;
              }
              const formatted = dayjs(date).format("YYYY-MM-DD");
              setRawInput(formatted);
              setIsInvalid(false);
              onValueChange?.(formatted);
              setPopoverOpen(false);
            }}
          />
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
});

DateInput.displayName = "DateInput";
