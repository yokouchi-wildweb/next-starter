// src/components/Form/Input/Manual/TimeFields.tsx
//
// 時/分の分離数値入力。TimeInput / DatetimeInput の Popover 内で共用する。
// - 表示はゼロ埋め2桁、ただし編集中は1桁状態を許容（"2" → "21" の自然な打鍵）
// - フォーカス時は全選択し、次の打鍵で先頭から上書きされる
// - 2桁が確定すると自動で次のフィールドへフォーカス遷移
// - 矢印キーで ±1、Shift+矢印で ±10 / ±5（時/分）
// - スクロールで値変更
// - 24h時計固定（am/pmは採用しない）

"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type WheelEvent } from "react";

import { Input } from "./Input";

export type TimeFieldsProps = {
  /** 時 (0-23) */
  hour: number | null;
  /** 分 (0-59) */
  minute: number | null;
  onChange: (next: { hour: number; minute: number }) => void;
  /** 最小入力幅を揃えるためのクラス */
  className?: string;
};

const HOUR_MAX = 23;
const MINUTE_MAX = 59;

const clamp = (value: number, max: number) => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

const pad2 = (value: number | null) =>
  value === null ? "" : value.toString().padStart(2, "0");

export function TimeFields({ hour, minute, onChange, className }: TimeFieldsProps) {
  const hourRef = useRef<HTMLInputElement | null>(null);
  const minuteRef = useRef<HTMLInputElement | null>(null);

  // 編集中ローカル文字列。null の場合は親の値を pad2 で表示する。
  // 1桁入力途中（例: "2"）を保持するために必要。
  const [editingHour, setEditingHour] = useState<string | null>(null);
  const [editingMinute, setEditingMinute] = useState<string | null>(null);

  const emit = useCallback(
    (nextHour: number | null, nextMinute: number | null) => {
      onChange({
        hour: clamp(nextHour ?? 0, HOUR_MAX),
        minute: clamp(nextMinute ?? 0, MINUTE_MAX),
      });
    },
    [onChange],
  );

  const handleHourKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const current = hour ?? 0;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setEditingHour(null);
      emit(clamp(current + (event.shiftKey ? 10 : 1), HOUR_MAX), minute);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setEditingHour(null);
      emit(clamp(current - (event.shiftKey ? 10 : 1), HOUR_MAX), minute);
    } else if (event.key === "ArrowRight" && event.currentTarget.selectionStart === event.currentTarget.value.length) {
      event.preventDefault();
      minuteRef.current?.focus();
      minuteRef.current?.select();
    }
  };

  const handleMinuteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const current = minute ?? 0;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setEditingMinute(null);
      emit(hour, clamp(current + (event.shiftKey ? 5 : 1), MINUTE_MAX));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setEditingMinute(null);
      emit(hour, clamp(current - (event.shiftKey ? 5 : 1), MINUTE_MAX));
    } else if (event.key === "ArrowLeft" && event.currentTarget.selectionStart === 0) {
      event.preventDefault();
      hourRef.current?.focus();
      hourRef.current?.select();
    }
  };

  const handleWheel =
    (kind: "hour" | "minute") => (event: WheelEvent<HTMLInputElement>) => {
      if (document.activeElement !== event.currentTarget) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1 : -1;
      if (kind === "hour") {
        setEditingHour(null);
        emit(clamp((hour ?? 0) + delta, HOUR_MAX), minute);
      } else {
        setEditingMinute(null);
        emit(hour, clamp((minute ?? 0) + delta, MINUTE_MAX));
      }
    };

  // 入力共通処理。
  // - 数字以外を除去し最大2桁に制限
  // - 0桁/1桁は編集中文字列としてそのまま保持（pad2 しない）
  // - 2桁達成で clamp し、必要なら次のフィールドへフォーカス遷移
  const handleInput = (
    raw: string,
    kind: "hour" | "minute",
  ): { editing: string; numeric: number; completed: boolean } => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const max = kind === "hour" ? HOUR_MAX : MINUTE_MAX;
    if (digits.length === 0) {
      return { editing: "", numeric: 0, completed: false };
    }
    if (digits.length === 1) {
      return { editing: digits, numeric: Number(digits), completed: false };
    }
    const numeric = clamp(Number(digits), max);
    return { editing: pad2(numeric), numeric, completed: true };
  };

  const hourDisplay = editingHour ?? pad2(hour);
  const minuteDisplay = editingMinute ?? pad2(minute);

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-1">
        <Input
          ref={hourRef}
          type="text"
          inputMode="numeric"
          aria-label="時"
          className="w-14 text-center tabular-nums"
          value={hourDisplay}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={handleHourKeyDown}
          onWheel={handleWheel("hour")}
          onChange={(event) => {
            const { editing, numeric, completed } = handleInput(event.target.value, "hour");
            setEditingHour(editing);
            emit(numeric, minute);
            if (completed) {
              // 2桁確定で分フィールドへ自動遷移
              minuteRef.current?.focus();
              minuteRef.current?.select();
            }
          }}
          onBlur={() => setEditingHour(null)}
        />
        <span className="select-none text-muted-foreground">:</span>
        <Input
          ref={minuteRef}
          type="text"
          inputMode="numeric"
          aria-label="分"
          className="w-14 text-center tabular-nums"
          value={minuteDisplay}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={handleMinuteKeyDown}
          onWheel={handleWheel("minute")}
          onChange={(event) => {
            const { editing, numeric } = handleInput(event.target.value, "minute");
            setEditingMinute(editing);
            emit(hour, numeric);
          }}
          onBlur={() => setEditingMinute(null)}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        ↑↓ で増減（Shift で刻み増）、Tab で移動
      </p>
    </div>
  );
}
