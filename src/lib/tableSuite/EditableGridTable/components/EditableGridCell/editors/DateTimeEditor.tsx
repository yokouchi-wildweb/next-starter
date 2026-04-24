"use client";

import React from "react";
import dayjs from "dayjs";
import { Input } from "@/components/Form/Input/Manual";
import {
  parseFlexibleDate,
  parseFlexibleDatetime,
  parseFlexibleTime,
} from "@/lib/date/parseFlexible";
import type { BaseEditorProps } from "../types";

// グリッドセル内では Popover/Calendar を開くと
// 「ポップオーバー操作 → 入力 blur → セル編集終了 → ポップオーバー消滅」という
// フォーカスと編集モードの衝突が起きやすいため、セル用エディタは
// テキスト入力 + 柔軟パース のみに絞る。
// フォームダイアログなどサイズに余裕のある箇所では DateInput / TimeInput /
// DatetimeInput (Manual) のピッカー付きバージョンを利用する。

type CellType = "date" | "time" | "datetime";

type DateTimeEditorProps<T> = BaseEditorProps<T> & {
  type: CellType;
};

const INPUT_FORMAT: Record<CellType, string> = {
  date: "YYYY-MM-DD",
  time: "HH:mm",
  datetime: "YYYY-MM-DDTHH:mm",
};

const PLACEHOLDER: Record<CellType, string> = {
  date: "YYYY-MM-DD",
  time: "HH:mm",
  datetime: "YYYY-MM-DD HH:mm",
};

const parse = (type: CellType, raw: string): string | null => {
  if (type === "date") return parseFlexibleDate(raw);
  if (type === "time") return parseFlexibleTime(raw);
  return parseFlexibleDatetime(raw);
};

const formatForDisplay = (type: CellType, value: string): string => {
  if (!value) return "";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(INPUT_FORMAT[type]) : value;
};

export function DateTimeEditor<T>({
  type,
  value,
  placeholder,
  error,
  className,
  inputRef,
  onCommit,
  onCancel,
  onDraftChange,
}: DateTimeEditorProps<T>) {
  // セル開始時の value を表示用に正規化（既存データ互換）
  const initialDisplay = React.useMemo(() => formatForDisplay(type, value), [type, value]);

  const commitIfValid = React.useCallback(
    (raw: string) => {
      const parsed = parse(type, raw);
      if (parsed === null) {
        // パース不能: 生の値をドラフトに保持し、グリッド側のバリデーションで弾く
        onDraftChange(raw);
        onCommit();
        return;
      }
      onDraftChange(parsed);
      onCommit(parsed);
    },
    [type, onCommit, onDraftChange],
  );

  return (
    <Input
      data-cell-editor
      data-editor-type={type}
      type="text"
      inputMode={type === "time" ? "numeric" : undefined}
      className={className}
      defaultValue={initialDisplay}
      placeholder={placeholder || PLACEHOLDER[type]}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => onDraftChange(event.target.value)}
      onBlur={(event: React.FocusEvent<HTMLInputElement>) => commitIfValid(event.target.value)}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitIfValid(event.currentTarget.value);
          inputRef.current?.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      ref={(node: HTMLInputElement | null) => {
        if (inputRef && "current" in inputRef) {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      }}
      aria-invalid={error ? true : undefined}
    />
  );
}
