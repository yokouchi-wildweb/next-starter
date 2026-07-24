// @/components/Form/Input/Manual/DateInput.tsx
//
// 日付入力コンポーネント。
// - テキスト直入力・ペースト対応（空白/スラッシュ/ドット/和文など広めに受理）
// - 直接入力は厳密パースが成立した時点で即 onValueChange（blur を待たない）。
//   blur は従来どおり表示の正規化と invalid 判定を担う
// - 右側アイコンクリックで Popover に Calendar を表示
// - 時刻入力がないため確定ボタンは置かず、日付クリック/クリア/現在は
//   その場で確定して Popover を閉じる（ドラフトを持たない即確定モデル）
// - 入出力契約: value は DateLike、onValueChange は "YYYY-MM-DD" または "" を返す
//
// className プロパティの規約:
// - className: コンポーネント全体（ラッパー要素）に適用。レイアウト・幅制御
//   （max-w-* / w-* など）はここで指定する。
// - inputClassName: 内部の <input> 要素に直接適用（border / bg / shadow など内側スタイル拡張用）
// - containerClassName: 廃止予定（@deprecated）。後方互換のため className とマージされる。

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
import { Button } from "@/components/Form/Button";
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
  /** 内部 <input> 要素に追加適用するクラス */
  inputClassName?: string;
  /** @deprecated `className` を使用してください（後方互換のためマージされます）*/
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
    inputClassName,
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
    // 入力中テキストと意味的に同値（タイピング中の即コミットが value 経由で
    // 戻ってきたケース）なら表示を上書きせず、入力継続を妨げない
    const formatted = formatDateValue(value);
    if (parseFlexibleDate(rawInput) !== formatted) {
      setRawInput(formatted);
      setIsInvalid(false);
    }
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

  const currentDate = useMemo(() => {
    const parsed = dayjs(rawInput, "YYYY-MM-DD", true);
    return parsed.isValid() ? parsed.toDate() : undefined;
  }, [rawInput]);

  // 日付クリック・現在ボタンから呼ぶ即確定処理。値を反映して Popover を閉じる
  const commitAndClose = (date: Date | undefined) => {
    if (date) {
      const formatted = dayjs(date).format("YYYY-MM-DD");
      setRawInput(formatted);
      setIsInvalid(false);
      onValueChange?.(formatted);
    }
    // 選択済みの日を再クリック（選択解除イベント）は現値を維持して閉じるだけ
    setPopoverOpen(false);
  };

  return (
    <div className={cn("relative flex h-fit items-center", containerClassName, className)}>
      <Input
        {...rest}
        ref={assignRef}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        className={cn("pr-10", inputClassName)}
        value={rawInput}
        aria-invalid={isInvalid || rest["aria-invalid"]}
        onChange={(event) => {
          onChange?.(event);
          const next = event.target.value;
          setRawInput(next);
          if (isInvalid) setIsInvalid(false);
          // 完全な値として厳密パースできた時点で即コミット（クリア "" も含む）。
          // 表示の正規化は blur に任せ、入力中の rawInput は書き換えない
          const parsed = parseFlexibleDate(next);
          if (parsed !== null) onValueChange?.(parsed);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          commit(event.target.value);
        }}
      />
      <PopoverRoot modal open={popoverOpen} onOpenChange={setPopoverOpen}>
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
            selected={currentDate}
            defaultMonth={currentDate}
            onSelect={commitAndClose}
          />
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
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => commitAndClose(new Date())}
            >
              現在
            </Button>
          </div>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
});

DateInput.displayName = "DateInput";
