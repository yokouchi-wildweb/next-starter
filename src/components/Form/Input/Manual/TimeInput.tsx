// @/components/Form/Input/Manual/TimeInput.tsx
//
// 時刻入力コンポーネント。
// - テキスト直入力・ペースト対応（HH:mm / H:mm / HHmm / 和文等）
// - 右側アイコンクリックで Popover に TimeFields（時/分の分離数値入力）を表示
// - 入出力契約: value は TimeLike、onValueChange は "HH:mm" または "" を返す

"use client";

import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { Clock } from "lucide-react";
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
import { parseFlexibleTime } from "@/lib/date/parseFlexible";
import { Button } from "@/components/Form/Button";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "@/components/Overlays/Popover/PopoverPrimitives";

import { Input } from "./Input";
import { TimeFields } from "./TimeFields";

type InputProps = ComponentProps<typeof Input>;
type TimeLike = string | Date | number | Dayjs | null | undefined;

type BaseProps = Omit<InputProps, "type" | "value" | "defaultValue" | "onChange">;

export type TimeInputProps = BaseProps & {
  value?: TimeLike;
  defaultValue?: TimeLike;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

const formatTimeValue = (value: TimeLike): string => {
  if (value == null) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const isoMatch = trimmed.match(/[T\s](\d{2}:\d{2})/);
    if (isoMatch) return isoMatch[1];
    const hhmmMatch = trimmed.match(/^(\d{2}:\d{2})/);
    if (hhmmMatch) return hhmmMatch[1];
    const hhmmssMatch = trimmed.match(/^(\d{2}:\d{2}):\d{2}(?:\.\d+)?$/);
    if (hhmmssMatch) return hhmmssMatch[1];
    return trimmed;
  }

  if (typeof value === "number") return dayjs(value).format("HH:mm");
  if (dayjs.isDayjs(value)) return value.format("HH:mm");
  if (value instanceof Date) return dayjs(value).format("HH:mm");
  return "";
};

const parseHHmm = (value: string): { hour: number; minute: number } | null => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>((props, forwardedRef) => {
  const {
    value,
    defaultValue,
    onValueChange,
    containerClassName,
    className,
    onBlur,
    onChange,
    placeholder = "HH:mm",
    ...rest
  } = props;

  const hasValueProp = Object.prototype.hasOwnProperty.call(props, "value");
  const hasDefaultValueProp = Object.prototype.hasOwnProperty.call(props, "defaultValue");

  const initialFormatted = useMemo(() => {
    if (hasValueProp) return formatTimeValue(value);
    if (hasDefaultValueProp) return formatTimeValue(defaultValue);
    return "";
  }, [hasValueProp, hasDefaultValueProp, value, defaultValue]);

  const [rawInput, setRawInput] = useState<string>(initialFormatted);
  const [isInvalid, setIsInvalid] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draftTime, setDraftTime] = useState<{ hour: number; minute: number } | null>(null);
  const [prevExternalValue, setPrevExternalValue] = useState(value);
  const localRef = useRef<HTMLInputElement | null>(null);

  if (hasValueProp && value !== prevExternalValue) {
    setPrevExternalValue(value);
    setRawInput(formatTimeValue(value));
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
      const parsed = parseFlexibleTime(next);
      if (parsed === null) {
        setIsInvalid(true);
        return;
      }
      setIsInvalid(false);
      setRawInput(parsed);
      onValueChange?.(parsed);
    },
    [onValueChange],
  );

  const parsedHHmm = parseHHmm(rawInput);

  const handlePopoverOpenChange = (open: boolean) => {
    // 開く瞬間に現在値をドラフトへ。閉じる（外クリック・Escape）はドラフト破棄扱い。
    if (open) setDraftTime(parsedHHmm);
    setPopoverOpen(open);
  };

  const confirmDraft = () => {
    if (!draftTime) {
      setRawInput("");
      setIsInvalid(false);
      onValueChange?.("");
    } else {
      const formatted = `${draftTime.hour.toString().padStart(2, "0")}:${draftTime.minute
        .toString()
        .padStart(2, "0")}`;
      setRawInput(formatted);
      setIsInvalid(false);
      onValueChange?.(formatted);
    }
    setPopoverOpen(false);
  };

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
      <PopoverRoot modal open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="時刻ピッカーを開く"
            tabIndex={-1}
            disabled={rest.disabled || rest.readOnly}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Clock className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent size="auto" align="end" className="p-0">
          <div className="p-3">
            <TimeFields
              hour={draftTime?.hour ?? null}
              minute={draftTime?.minute ?? null}
              onChange={({ hour, minute }) => setDraftTime({ hour, minute })}
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setRawInput("");
                setIsInvalid(false);
                onValueChange?.("");
                setPopoverOpen(false);
              }}
            >
              クリア
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  const now = dayjs();
                  setDraftTime({ hour: now.hour(), minute: now.minute() });
                }}
              >
                現在
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setPopoverOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={confirmDraft}
              >
                確定
              </Button>
            </div>
          </div>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
});

TimeInput.displayName = "TimeInput";
