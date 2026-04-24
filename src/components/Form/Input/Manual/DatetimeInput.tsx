// @/components/Form/Input/Manual/DatetimeInput.tsx
//
// 日時入力コンポーネント。
// - テキスト直入力・ペースト対応（ISO/和文/各種区切りを広く受理）
// - 右側アイコンクリックで Popover に Calendar + TimeFields を表示
// - 入出力契約: value は DatetimeLike、onValueChange は "YYYY-MM-DDTHH:mm" または "" を返す

"use client";

import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { CalendarClock } from "lucide-react";
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
import { parseFlexibleDatetime } from "@/lib/date/parseFlexible";
import { Button } from "@/components/Form/Button";
import { Calendar } from "@/components/Overlays/Calendar";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "@/components/Overlays/Popover/PopoverPrimitives";

import { Input } from "./Input";
import { TimeFields } from "./TimeFields";

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

const OUTPUT_FORMAT = "YYYY-MM-DDTHH:mm";

const formatDatetimeValue = (value: DatetimeLike): string => {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = dayjs(trimmed);
    return parsed.isValid() ? parsed.format(OUTPUT_FORMAT) : trimmed;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(OUTPUT_FORMAT) : "";
};

export const DatetimeInput = forwardRef<HTMLInputElement, DatetimeInputProps>(
  (props, forwardedRef) => {
    const {
      value,
      defaultValue,
      onValueChange,
      containerClassName,
      className,
      onBlur,
      onChange,
      placeholder = "YYYY-MM-DD HH:mm",
      ...rest
    } = props;

    const hasValueProp = Object.prototype.hasOwnProperty.call(props, "value");
    const hasDefaultValueProp = Object.prototype.hasOwnProperty.call(
      props,
      "defaultValue",
    );

    const initialFormatted = useMemo(() => {
      if (hasValueProp) return formatDatetimeValue(value);
      if (hasDefaultValueProp) return formatDatetimeValue(defaultValue);
      return "";
    }, [hasValueProp, hasDefaultValueProp, value, defaultValue]);

    const [rawInput, setRawInput] = useState<string>(initialFormatted);
    const [isInvalid, setIsInvalid] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [draftDatetime, setDraftDatetime] = useState<Dayjs | null>(null);
    const [prevExternalValue, setPrevExternalValue] = useState(value);
    const localRef = useRef<HTMLInputElement | null>(null);

    if (hasValueProp && value !== prevExternalValue) {
      setPrevExternalValue(value);
      setRawInput(formatDatetimeValue(value));
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
        const parsed = parseFlexibleDatetime(next);
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

    const currentDayjs = useMemo(() => {
      const parsed = dayjs(rawInput, OUTPUT_FORMAT, true);
      return parsed.isValid() ? parsed : null;
    }, [rawInput]);

    const handlePopoverOpenChange = (open: boolean) => {
      // 開く瞬間に現在値をドラフトへ。閉じる（外クリック・Escape）はドラフト破棄扱い。
      if (open) setDraftDatetime(currentDayjs);
      setPopoverOpen(open);
    };

    const confirmDraft = () => {
      if (!draftDatetime) {
        setRawInput("");
        setIsInvalid(false);
        onValueChange?.("");
      } else {
        const formatted = draftDatetime.format(OUTPUT_FORMAT);
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
              aria-label="カレンダーを開く"
              tabIndex={-1}
              disabled={rest.disabled || rest.readOnly}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarClock className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent size="auto" align="end" className="p-0">
            <Calendar
              mode="single"
              selected={draftDatetime?.toDate()}
              defaultMonth={draftDatetime?.toDate() ?? currentDayjs?.toDate()}
              onSelect={(date) => {
                if (!date) {
                  setDraftDatetime(null);
                  return;
                }
                const base = draftDatetime ?? dayjs(date);
                setDraftDatetime(dayjs(date).hour(base.hour()).minute(base.minute()));
              }}
            />
            <div className="border-t px-3 py-3">
              <TimeFields
                hour={draftDatetime?.hour() ?? null}
                minute={draftDatetime?.minute() ?? null}
                onChange={({ hour, minute }) => {
                  const base = draftDatetime ?? dayjs().startOf("day");
                  setDraftDatetime(base.hour(hour).minute(minute));
                }}
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
                  onClick={() => setDraftDatetime(dayjs())}
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
  },
);

DatetimeInput.displayName = "DatetimeInput";
