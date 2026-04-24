// src/components/Form/Input/Manual/TimeFields.tsx
//
// 時/分の分離数値入力。TimeInput / DatetimeInput の Popover 内で共用する。
// - 2桁ゼロ埋め表示
// - 矢印キーで ±1、Shift+矢印で ±10 / ±5（時/分）
// - スクロールで値変更
// - 24h時計固定（am/pmは採用しない）

"use client";

import { useCallback, useRef, type KeyboardEvent, type WheelEvent } from "react";

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
      emit(clamp(current + (event.shiftKey ? 10 : 1), HOUR_MAX), minute);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
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
      emit(hour, clamp(current + (event.shiftKey ? 5 : 1), MINUTE_MAX));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
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
        emit(clamp((hour ?? 0) + delta, HOUR_MAX), minute);
      } else {
        emit(hour, clamp((minute ?? 0) + delta, MINUTE_MAX));
      }
    };

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-1">
        <Input
          ref={hourRef}
          type="text"
          inputMode="numeric"
          aria-label="時"
          className="w-14 text-center tabular-nums"
          value={pad2(hour)}
          maxLength={2}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={handleHourKeyDown}
          onWheel={handleWheel("hour")}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, "").slice(-2);
            emit(raw === "" ? 0 : Number(raw), minute);
          }}
        />
        <span className="select-none text-muted-foreground">:</span>
        <Input
          ref={minuteRef}
          type="text"
          inputMode="numeric"
          aria-label="分"
          className="w-14 text-center tabular-nums"
          value={pad2(minute)}
          maxLength={2}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={handleMinuteKeyDown}
          onWheel={handleWheel("minute")}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, "").slice(-2);
            emit(hour, raw === "" ? 0 : Number(raw));
          }}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        ↑↓ で増減（Shift で刻み増）、Tab で移動
      </p>
    </div>
  );
}
