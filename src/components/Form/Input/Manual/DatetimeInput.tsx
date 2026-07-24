// @/components/Form/Input/Manual/DatetimeInput.tsx
//
// 日時入力コンポーネント。
// - テキスト直入力・ペースト対応（ISO/和文/各種区切りを広く受理）
// - 直接入力は厳密パースが成立した時点で即 onValueChange（blur を待たない）。
//   blur は従来どおり表示の正規化と invalid 判定を担う
// - 右側アイコンクリックで Popover に Calendar + TimeFields を表示
// - Popover 内フォーカスフロー: 日付クリック → 時（全選択）→ 分 → 確定ボタン
//   （時/分は数字の連続入力で自動遷移。詳細は TimeFields 参照）
// - クリア/現在はドラフト操作のみ。値への反映は必ず確定ボタン経由
//   （外クリック・Escape・キャンセルはドラフト破棄）
// - 入出力契約: value は DatetimeLike、onValueChange は既定で "YYYY-MM-DD HH:mm" または "" を返す
// - outputFormat="iso" 指定時、onValueChange はブラウザローカルTZのオフセット付き ISO8601
//   （例: "2026-07-24T11:00:00+09:00"）を返す。サーバーの datetime スキーマ
//   （nullableDatetime/requiredDatetime）はTZオフセットなしの日時文字列を拒否するため、
//   RHF Controlled ラッパーを介さず出力を直接 API に送る場合は必ず "iso" を使うこと
//
// className プロパティの規約:
// - className: コンポーネント全体（ラッパー要素）に適用。レイアウト・幅制御
//   （max-w-* / w-* など）はここで指定する。
// - inputClassName: 内部の <input> 要素に直接適用（border / bg / shadow など内側スタイル拡張用）
// - containerClassName: 廃止予定（@deprecated）。後方互換のため className とマージされる。

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
import { TimeFields, type TimeFieldsHandle } from "./TimeFields";

type InputProps = ComponentProps<typeof Input>;
type DatetimeLike = string | Date | number | Dayjs | null | undefined;

type BaseProps = Omit<InputProps, "type" | "value" | "defaultValue" | "onChange">;

export type DatetimeInputProps = BaseProps & {
  value?: DatetimeLike;
  defaultValue?: DatetimeLike;
  onValueChange?: (value: string) => void;
  /**
   * onValueChange の出力形式
   * - "display"（既定）: "YYYY-MM-DD HH:mm"（TZナイーブ・表示用）
   * - "iso": ブラウザローカルTZのオフセット付き ISO8601（API 直送する非RHF用途はこちら）
   */
  outputFormat?: "display" | "iso";
  /** 内部 <input> 要素に追加適用するクラス */
  inputClassName?: string;
  /** @deprecated `className` を使用してください（後方互換のためマージされます）*/
  containerClassName?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

const OUTPUT_FORMAT = "YYYY-MM-DD HH:mm";

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
      outputFormat = "display",
      containerClassName,
      className,
      inputClassName,
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
    const timeFieldsRef = useRef<TimeFieldsHandle | null>(null);
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

    if (hasValueProp && value !== prevExternalValue) {
      setPrevExternalValue(value);
      // 入力中テキストと意味的に同値（タイピング中の即コミットが value 経由で
      // 戻ってきたケース）なら表示を上書きせず、入力継続を妨げない
      const formatted = formatDatetimeValue(value);
      if (parseFlexibleDatetime(rawInput) !== formatted) {
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

    // 正規化済み表示文字列（"YYYY-MM-DD HH:mm" または ""）を outputFormat に応じて変換して通知。
    // 内部状態（rawInput）は常に表示形式のまま保持し、変換は出力の瞬間のみ行う
    const emitValue = useCallback(
      (normalized: string) => {
        if (!onValueChange) return;
        if (!normalized) {
          onValueChange("");
          return;
        }
        onValueChange(
          outputFormat === "iso"
            ? dayjs(normalized, OUTPUT_FORMAT, true).format()
            : normalized,
        );
      },
      [onValueChange, outputFormat],
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
        emitValue(parsed);
      },
      [emitValue],
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
        emitValue("");
      } else {
        const formatted = draftDatetime.format(OUTPUT_FORMAT);
        setRawInput(formatted);
        setIsInvalid(false);
        emitValue(formatted);
      }
      setPopoverOpen(false);
    };

    return (
      <div className={cn("relative flex h-fit items-center", containerClassName, className)}>
        <Input
          {...rest}
          ref={assignRef}
          type="text"
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
            const parsed = parseFlexibleDatetime(next);
            if (parsed !== null) emitValue(parsed);
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
                // 日付選択後は時フィールドへフォーカス。再レンダー後の値に対して
                // 全選択が効くよう1フレーム遅らせる
                requestAnimationFrame(() => timeFieldsRef.current?.focusHour());
              }}
            />
            <div className="border-t px-3 py-3">
              <TimeFields
                ref={timeFieldsRef}
                hour={draftDatetime?.hour() ?? null}
                minute={draftDatetime?.minute() ?? null}
                onChange={({ hour, minute }) => {
                  const base = draftDatetime ?? dayjs().startOf("day");
                  setDraftDatetime(base.hour(hour).minute(minute));
                }}
                onComplete={() => confirmButtonRef.current?.focus()}
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setDraftDatetime(null)}
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
                  ref={confirmButtonRef}
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
