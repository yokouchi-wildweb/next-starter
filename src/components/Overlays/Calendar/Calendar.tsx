// src/components/Overlays/Calendar/Calendar.tsx
//
// プロジェクト用 Calendar ラッパー。
// 日本語ロケール・日本表記のキャプション・月曜始まりを既定とする。
// キャプションは年月ドロップダウン（captionLayout="dropdown"）を既定とし、
// 矢印の1ヶ月送りに加えて任意の年月へ直接ジャンプできる。
// 「今日」はアクセント色だと選択済みと紛らわしいため、薄グレー背景+濃グレー枠線に抑える
// （選択中の日は selected スタイルを優先し、today の装飾は外す）。

"use client";

import { ja } from "react-day-picker/locale";
import { type ComponentProps } from "react";

import { Calendar as ShadcnCalendar } from "@/components/_shadcn/calendar";

export type CalendarProps = ComponentProps<typeof ShadcnCalendar>;

// 年ドロップダウンの選択肢範囲の既定値（生年月日〜遠い将来の予定まで賄える汎用値）
const DEFAULT_START_MONTH = new Date(1900, 0);
const DEFAULT_END_MONTH = new Date(2100, 11);

export function Calendar({
  locale = ja,
  weekStartsOn = 1,
  captionLayout = "dropdown",
  startMonth = DEFAULT_START_MONTH,
  endMonth = DEFAULT_END_MONTH,
  formatters,
  classNames,
  ...props
}: CalendarProps) {
  return (
    <ShadcnCalendar
      locale={locale}
      weekStartsOn={weekStartsOn}
      captionLayout={captionLayout}
      startMonth={startMonth}
      endMonth={endMonth}
      formatters={{
        // 年ドロップダウンの表示を「2026年」形式に（既定は "2026"）
        formatYearDropdown: (year) => `${year.getFullYear()}年`,
        ...formatters,
      }}
      classNames={{
        // 枠線はレイアウトを崩さないよう内側の day ボタン（box-border）に付ける
        today:
          "rounded-md [&:not(:has([aria-selected]))]:bg-muted [&:not(:has([aria-selected]))>button]:border [&:not(:has([aria-selected]))>button]:border-muted-foreground",
        // 週行の縦余白（素体の mt-2 / space-y-1）を除去し、ポップオーバーの縦伸びを抑える
        month_grid: "w-full border-collapse",
        week: "flex w-full",
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";
